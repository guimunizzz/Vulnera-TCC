/** Vuvu contextual em memória por sessão; enviada somente por ação explícita do usuário. */
import { createContext, useContext, useEffect, useRef, useState, type ComponentRef, type ReactNode } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { usePathname, useRouter, type Href } from "expo-router";
import axios from "axios";
import { assistantApi, type AssistantHistory, type AssistantResponse } from "../api/assistant.api";
import { assistantActions, assistantScreen, type AssistantActionId, type AssistantScreen } from "../lib/assistant-context";
import { FONT_FAMILY, RADIUS } from "../theme/tokens";
import { useAppTheme } from "../theme/use-app-theme";
import { AssistantMascot } from "./assistant-mascot";
import { SoftPressable, useWorkspaceReducedMotion } from "./workspace-motion";

type Message = AssistantHistory & { actions?: AssistantResponse["actions"] };
const AssistantContext = createContext<((screen: AssistantScreen) => void) | null>(null);

export function AssistantButton({ screen }: { screen?: AssistantScreen }) {
  const open = useContext(AssistantContext);
  const pathname = usePathname();
  const { colors } = useAppTheme();
  if (!open) return null;
  return <SoftPressable accessibilityRole="button" accessibilityLabel="Abrir assistente Vuvu" testID="assistant-open"
    onPress={() => open(screen ?? assistantScreen(pathname))}
    style={[styles.launcher, { borderColor: `${colors.assistantInk}50`, backgroundColor: `${colors.assistantInk}12` }]}>
    <Ionicons name="chatbubble-ellipses-outline" size={20} color={colors.assistantInk} />
  </SoftPressable>;
}

export function AssistantSession({ children }: { children: ReactNode }) {
  const { workspace, ui } = useAppTheme();
  const router = useRouter();
  const reduced = useWorkspaceReducedMotion();
  const [visible, setVisible] = useState(false);
  const [screen, setScreen] = useState<AssistantScreen>("dashboard");
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingText, setPendingText] = useState<string | null>(null);
  const request = useRef<AbortController | null>(null);
  const alive = useRef(true);
  const scroll = useRef<ComponentRefScroll>(null);
  const showIntro = !messages.length && !pendingText && !error;
  const canSend = !pending && !!draft.trim();
  useEffect(() => { alive.current = true; return () => { alive.current = false; request.current?.abort(); }; }, []);

  async function send() {
    const question = draft.trim();
    if (!question || question.length > 1000 || request.current) return;
    const controller = new AbortController(); request.current = controller;
    const history = messages.slice(-6).map(({ role, content }) => ({ role, content: content.slice(0, 1000) }));
    while (history.reduce((sum, item) => sum + item.content.length, 0) > 4000) history.shift();
    setPending(true); setPendingText(question); setError(null);
    try {
      const response = await assistantApi.chat(question, screen, history, controller.signal);
      if (!alive.current || controller.signal.aborted) return;
      if (!response.message?.trim()) throw new Error("EMPTY_RESPONSE");
      setMessages((previous) => [...previous, { role: "user", content: question }, { role: "assistant", content: response.message, actions: Array.isArray(response.actions) ? response.actions : [] }]);
      setDraft("");
    } catch (failure) {
      if (!alive.current || controller.signal.aborted) return;
      setError(axios.isAxiosError(failure) && failure.response?.status === 429 ? "Limite temporário atingido. Aguarde antes de tentar novamente." : "Não foi possível obter uma resposta. Tente novamente.");
    } finally {
      if (request.current === controller) request.current = null;
      if (alive.current) { setPending(false); setPendingText(null); }
    }
  }

  return <AssistantContext.Provider value={(next) => { setScreen(next); setVisible(true); }}>
    {children}
    <Modal visible={visible} animationType={reduced ? "none" : "slide"} statusBarTranslucent navigationBarTranslucent onRequestClose={() => setVisible(false)}>
      {/* O modal tem sua própria janela nativa e mede as barras do sistema nela. */}
      <SafeAreaProvider style={[styles.screen, { backgroundColor: workspace.background }]}>
        <SafeAreaView style={styles.flex}>
          <KeyboardAvoidingView style={styles.content} behavior={Platform.OS === "ios" ? "padding" : undefined}>
            <View style={[styles.header, { borderBottomColor: workspace.line }]}>
              <View testID="vuvu-portrait" style={[styles.portrait, { backgroundColor: workspace.neutralTint }]}>
                <AssistantMascot width={40} />
              </View>
              <Text accessibilityRole="header" style={[ui.heading, styles.flex]}>Vuvu</Text>
              <SoftPressable accessibilityRole="button" accessibilityLabel="Fechar assistente" onPress={() => setVisible(false)} style={styles.icon}>
                <Ionicons name="close" size={23} color={workspace.text} />
              </SoftPressable>
            </View>
            <ScrollView ref={scroll} style={styles.flex} contentContainerStyle={[styles.messages, showIntro && styles.introContainer]}
              keyboardShouldPersistTaps="handled" keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
              onContentSizeChange={() => { if (!showIntro) scroll.current?.scrollToEnd({ animated: !reduced }); }}>
              {showIntro && <View style={styles.intro}>
                <View testID="vuvu-intro" style={styles.mascotStage}>
                  <View style={[styles.mascotHalo, { backgroundColor: workspace.neutralTint, borderColor: workspace.line }]} />
                  <AssistantMascot width={136} greet={visible} />
                </View>
                <Text style={[ui.heading, styles.introTitle]}>Como posso ajudar?</Text>
              </View>}
              {messages.map((item, index) => {
                const isUser = item.role === "user";
                return <View key={index} style={[styles.message, isUser ? styles.userMessage : styles.assistantMessage, { backgroundColor: isUser ? workspace.chipActiveBg : workspace.inset }]}>
                  <Text selectable accessibilityLabel={`${isUser ? "Você" : "Vuvu"}: ${item.content}`} style={ui.body}>{item.content}</Text>
                  {item.actions?.map((action) => {
                    if (!Object.prototype.hasOwnProperty.call(assistantActions, action.id)) return null;
                    const destination = assistantActions[action.id as AssistantActionId];
                    return <SoftPressable key={action.id} accessibilityRole="button" onPress={() => { setVisible(false); router.push(destination.path as Href); }} style={[styles.action, { borderColor: workspace.actionBorder }]}>
                      <Text style={[ui.body, { color: workspace.lavender }]}>{destination.label}</Text>
                    </SoftPressable>;
                  })}
                </View>;
              })}
              {pendingText && <View style={[styles.message, styles.userMessage, { backgroundColor: workspace.chipActiveBg }]}>
                <Text accessibilityLabel={`Você: ${pendingText}`} style={ui.body}>{pendingText}</Text>
              </View>}
              {pending && <View style={styles.waiting} accessibilityLiveRegion="polite"><ActivityIndicator color={workspace.lavender} /><Text style={ui.muted}>Vuvu está respondendo…</Text></View>}
              {error && <Text accessibilityRole="alert" style={[ui.body, { color: workspace.dangerInk }]}>{error}</Text>}
            </ScrollView>
            <View style={[styles.composer, { borderTopColor: workspace.line }]}>
              <View style={styles.composerRow}>
                <TextInput accessibilityLabel="Pergunta para Vuvu" multiline maxLength={1000} value={draft} editable={!pending} onChangeText={setDraft} placeholder="Digite sua pergunta" placeholderTextColor={workspace.muted} style={[styles.input, { color: workspace.text, backgroundColor: workspace.inset, borderColor: workspace.line }]} />
                <SoftPressable accessibilityRole="button" accessibilityLabel="Enviar pergunta" accessibilityState={{ disabled: !canSend }} disabled={!canSend} onPress={() => { void send(); }} style={[styles.send, { backgroundColor: workspace.actionBg }]}>
                  <Ionicons name="send" size={20} color={workspace.lavender} />
                </SoftPressable>
              </View>
              <Text style={[ui.muted, styles.privacy]}>Evite compartilhar dados sensíveis.</Text>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </SafeAreaProvider>
    </Modal>
  </AssistantContext.Provider>;
}

type ComponentRefScroll = ComponentRef<typeof ScrollView>;
const styles = StyleSheet.create({
  launcher: { width: 48, height: 48, borderRadius: RADIUS.control, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  screen: { flex: 1 }, content: { flex: 1, width: "100%", maxWidth: 640, alignSelf: "center" }, flex: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: 1 },
  portrait: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  icon: { width: 48, height: 48, alignItems: "center", justifyContent: "center" },
  messages: { gap: 12, padding: 16 }, introContainer: { flexGrow: 1, justifyContent: "center" },
  intro: { alignItems: "center", gap: 8, paddingVertical: 12 }, introTitle: { textAlign: "center" },
  mascotStage: { width: 148, height: 148, alignItems: "center", justifyContent: "center" },
  mascotHalo: { position: "absolute", width: 120, height: 120, borderRadius: 60, borderWidth: 1 },
  message: { maxWidth: "90%", borderRadius: 18, padding: 14, gap: 8 },
  userMessage: { alignSelf: "flex-end", borderBottomRightRadius: 6 },
  assistantMessage: { alignSelf: "flex-start", borderBottomLeftRadius: 6 },
  waiting: { flexDirection: "row", gap: 8, alignItems: "center" }, action: { minHeight: 48, justifyContent: "center", borderTopWidth: 1 },
  composer: { paddingHorizontal: 16, paddingVertical: 10, gap: 6, borderTopWidth: 1 },
  composerRow: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  input: { flex: 1, minHeight: 48, maxHeight: 120, borderWidth: 1, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12, fontFamily: FONT_FAMILY.regular, fontSize: 15 },
  send: { width: 48, height: 48, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  privacy: { fontSize: 11 },
});
