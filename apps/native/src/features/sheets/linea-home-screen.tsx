import { evaluateSheet, type EvaluatedLine } from "@linea/calc-engine";
import { getLineaTheme } from "../../../../../packages/design-tokens/src/index";
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useDeferredValue, useEffect, useRef, useState } from "react";

import {
  createLineaHomeScreenStyleSpec,
  getAdaptiveLayoutMetrics,
  getLibraryAnimationSpec,
  getLineaHomeScreenCopySpec,
  projectResultRailRows,
  resolveLineaThemeName,
  shouldOpenLibraryFromPull,
} from "./linea-home-screen.presentation";
import { useSheetWorkspace } from "./use-sheet-workspace";

export function LineaHomeScreen() {
  const colorScheme = useColorScheme();
  const theme = getLineaTheme(resolveLineaThemeName(colorScheme));
  const { fontScale, width } = useWindowDimensions();
  const metrics = getAdaptiveLayoutMetrics({ fontScale, width });
  const monoFont = Platform.select({
    android: theme.typography.monoFamilies.android,
    default: theme.typography.monoFamilies.default,
    ios: theme.typography.monoFamilies.ios,
  });
  const styles = StyleSheet.create(
    createLineaHomeScreenStyleSpec(
      theme,
      monoFont ?? theme.typography.monoFamilies.default,
      metrics
    )
  );
  const copy = getLineaHomeScreenCopySpec();
  const libraryPopoverWidth = metrics.libraryPopoverWidth;
  const resultsColumnWidth = metrics.resultsColumnWidth;
  const {
    activeSheet,
    createSheet,
    deleteSheet,
    isReady,
    renameActiveSheet,
    searchSheets,
    selectSheet,
    startupError,
    updateActiveSheetBody,
    workspace,
  } = useSheetWorkspace();
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [libraryQuery, setLibraryQuery] = useState("");
  const [editorContentHeight, setEditorContentHeight] = useState(0);
  const [evaluationLines, setEvaluationLines] = useState<EvaluatedLine[]>([]);
  const deferredLibraryQuery = useDeferredValue(libraryQuery);
  const deferredBody = useDeferredValue(activeSheet?.body ?? "");
  const libraryCardOpacity = useRef(new Animated.Value(0)).current;
  const libraryCardTranslateY = useRef(new Animated.Value(-24)).current;
  const [reduceMotionEnabled, setReduceMotionEnabled] = useState(false);
  const editorHeight = Math.max(
    320,
    Math.ceil(editorContentHeight) + theme.spacing.sm + theme.spacing.xl
  );
  const libraryAnimation = getLibraryAnimationSpec(reduceMotionEnabled);
  const openLibrary = () => {
    setLibraryOpen(true);
  };
  const closeLibrary = () => {
    setLibraryOpen(false);
  };
  const maybeOpenLibraryFromPull = (
    pullDistance: number,
    scrollOffsetY: number
  ) => {
    if (
      shouldOpenLibraryFromPull({
        isLibraryOpen: libraryOpen,
        pullDistance,
        scrollOffsetY,
      })
    ) {
      openLibrary();
      return true;
    }

    return false;
  };

  useEffect(() => {
    if (!activeSheet) {
      setEvaluationLines([]);
      return;
    }

    let cancelled = false;

    void evaluateSheet(deferredBody, {
      carryRoundedValues: false,
      precision: 2,
    }).then((evaluation) => {
      if (!cancelled) {
        setEvaluationLines(evaluation.lines);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [activeSheet, deferredBody]);

  useEffect(() => {
    let cancelled = false;

    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (!cancelled) {
        setReduceMotionEnabled(enabled);
      }
    });

    const subscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduceMotionEnabled
    );

    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (!libraryOpen) {
      return;
    }

    libraryCardOpacity.setValue(0);
    libraryCardTranslateY.setValue(libraryAnimation.translateY);

    if (reduceMotionEnabled) {
      libraryCardOpacity.setValue(1);
      libraryCardTranslateY.setValue(0);
      return;
    }

    Animated.parallel([
      Animated.timing(libraryCardOpacity, {
        duration: libraryAnimation.duration,
        toValue: 1,
        useNativeDriver: true,
      }),
      Animated.spring(libraryCardTranslateY, {
        damping: 20,
        mass: 0.9,
        stiffness: 220,
        toValue: 0,
        useNativeDriver: true,
      }),
    ]).start();
  }, [
    libraryAnimation.duration,
    libraryAnimation.translateY,
    libraryCardOpacity,
    libraryCardTranslateY,
    libraryOpen,
    reduceMotionEnabled,
  ]);

  if (!isReady) {
    return (
      <SafeAreaView style={styles.loadingScreen}>
        <ActivityIndicator color={theme.colors.foreground} size="large" />
        <Text style={styles.loadingTitle}>Opening Rekna</Text>
        <Text style={styles.loadingBody}>Preparing your local workspace.</Text>
      </SafeAreaView>
    );
  }

  if (startupError) {
    return (
      <SafeAreaView style={styles.loadingScreen}>
        <Text style={styles.errorTitle}>Rekna couldn&apos;t open.</Text>
        <Text style={styles.errorBody}>{startupError}</Text>
      </SafeAreaView>
    );
  }

  const visibleSheets =
    deferredLibraryQuery.trim().length > 0
      ? searchSheets(deferredLibraryQuery)
      : (workspace?.sheets ?? []).map((sheet) => ({
          id: sheet.id,
          snippet:
            sheet.body
              .split(/\r?\n/)
              .map((line) => line.trim())
              .find(Boolean) ?? "Empty sheet",
          tags: sheet.tags,
          title: sheet.title,
          updatedAt: sheet.updatedAt,
        }));
  const resultRows = projectResultRailRows(evaluationLines);

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.root}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.root}
      >
        <ScrollView
          alwaysBounceVertical
          bounces
          contentContainerStyle={styles.screenContent}
          keyboardShouldPersistTaps="handled"
          onScroll={(event) => {
            const offsetY = event.nativeEvent.contentOffset.y;
            const boundedOffsetY = Math.max(0, offsetY);
            const pullDistance = Math.max(0, -offsetY);

            maybeOpenLibraryFromPull(pullDistance, boundedOffsetY);
          }}
          scrollEventThrottle={16}
          style={styles.root}
        >
          <View style={styles.header}>
            <View style={styles.headerSide}>
              {copy.showSaveLabel ? <Text style={styles.saveLabel} /> : null}
            </View>
            <View style={styles.headerTitleWrap}>
              <TextInput
                accessibilityLabel="Sheet title"
                onChangeText={renameActiveSheet}
                placeholder="Untitled"
                placeholderTextColor={theme.colors.mutedForeground}
                selectionColor={theme.colors.caret}
                style={styles.headerTitleInput}
                value={activeSheet?.title ?? ""}
              />
            </View>
            <View style={styles.headerActions}>
              <Pressable
                accessibilityHint="Creates a new sheet"
                accessibilityLabel="Create sheet"
                accessibilityRole="button"
                onPress={createSheet}
                style={styles.headerButton}
              >
                <Text style={styles.headerButtonLabel}>+</Text>
              </Pressable>
              <Pressable
                accessibilityHint="Opens the sheets menu"
                accessibilityLabel="Open sheets menu"
                accessibilityRole="button"
                onPress={openLibrary}
                style={styles.headerButton}
              >
                <Text style={styles.headerButtonLabel}>≡</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.workspace}>
            <View style={styles.editorSurface}>
              <TextInput
                accessibilityLabel="Sheet editor"
                autoCapitalize="none"
                autoCorrect={false}
                multiline
                onChangeText={updateActiveSheetBody}
                onContentSizeChange={(event) =>
                  setEditorContentHeight(event.nativeEvent.contentSize.height)
                }
                placeholder={copy.editorPlaceholder}
                placeholderTextColor={theme.colors.mutedForeground}
                scrollEnabled={false}
                selectionColor={theme.colors.caret}
                style={[styles.editorInput, { height: editorHeight }]}
                textAlignVertical="top"
                value={activeSheet?.body ?? ""}
              />
            </View>

            <View
              style={[styles.resultsSurface, { width: resultsColumnWidth }]}
            >
              {copy.showResultsLabel ? (
                <Text style={styles.resultsLabel}>Results</Text>
              ) : null}
              <View style={styles.resultsScrollContent}>
                {resultRows.length === 0
                  ? null
                  : resultRows.map((row) => (
                      <View key={row.id} style={styles.resultRow}>
                        {row.hasValue ? (
                          <Text style={styles.resultValue}>
                            {row.displayValue}
                          </Text>
                        ) : null}
                      </View>
                    ))}
              </View>
            </View>
          </View>
        </ScrollView>

        <Modal
          animationType="fade"
          onRequestClose={closeLibrary}
          transparent
          visible={libraryOpen}
        >
          <View style={styles.modalBackdrop}>
            <SafeAreaView edges={["top"]}>
              <Animated.View
                style={[
                  styles.modalCard,
                  {
                    opacity: libraryCardOpacity,
                    transform: [{ translateY: libraryCardTranslateY }],
                    width: libraryPopoverWidth,
                  },
                ]}
                accessibilityViewIsModal
              >
                <View style={styles.modalHandle} />

                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Sheets</Text>
                  <Pressable
                    accessibilityLabel="Close sheets menu"
                    accessibilityRole="button"
                    onPress={closeLibrary}
                    style={styles.headerButton}
                  >
                    <Text style={styles.headerButtonLabel}>×</Text>
                  </Pressable>
                </View>

                <TextInput
                  accessibilityLabel="Search sheets"
                  onChangeText={setLibraryQuery}
                  placeholder="Quick Find"
                  placeholderTextColor={theme.colors.mutedForeground}
                  selectionColor={theme.colors.caret}
                  style={styles.searchInput}
                  underlineColorAndroid="transparent"
                  value={libraryQuery}
                />

                <ScrollView
                  contentContainerStyle={styles.libraryList}
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                >
                  {visibleSheets.map((sheet) => {
                    const isActive = sheet.id === activeSheet?.id;

                    return (
                      <View
                        key={sheet.id}
                        style={[
                          styles.sheetCard,
                          isActive ? styles.sheetCardActive : null,
                        ]}
                      >
                        <Pressable
                          accessibilityHint="Opens this sheet"
                          accessibilityLabel={`Open sheet ${sheet.title}`}
                          accessibilityRole="button"
                          accessibilityState={{ selected: isActive }}
                          onPress={() => {
                            selectSheet(sheet.id);
                            closeLibrary();
                          }}
                          style={styles.sheetCardMainAction}
                        >
                          <View style={styles.sheetCardCopy}>
                            <Text style={styles.sheetCardTitle}>
                              {sheet.title}
                            </Text>
                            <Text
                              numberOfLines={2}
                              style={styles.sheetCardSnippet}
                            >
                              {sheet.snippet}
                            </Text>
                          </View>
                        </Pressable>
                        {isActive ? (
                          <Text style={styles.resultValue}>✓</Text>
                        ) : (
                          <Pressable
                            accessibilityHint={`Deletes ${sheet.title}`}
                            accessibilityLabel={`Delete sheet ${sheet.title}`}
                            accessibilityRole="button"
                            disabled={(workspace?.sheets.length ?? 0) <= 1}
                            onPress={() => deleteSheet(sheet.id)}
                            style={styles.deleteButton}
                          >
                            <Text style={styles.deleteButtonLabel}>Delete</Text>
                          </Pressable>
                        )}
                      </View>
                    );
                  })}
                </ScrollView>
              </Animated.View>
            </SafeAreaView>
            <Pressable onPress={closeLibrary} style={styles.modalDismissArea} />
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
