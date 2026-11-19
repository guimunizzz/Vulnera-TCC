/** Vuvu contextual em memória por sessão; enviada somente por ação explícita do usuário. */
import { createContext, useContext, useEffect, useRef, useState, type ComponentRef, type ReactNode } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { usePathname, useRouter, type Href } from "expo-router";
import axios from "axios";
import { assistantApi, type AssistantHistory, type AssistantResponse } from "../api/assistant.api";
import { assistantActions, assistantScreen, type AssistantActionId, type AssistantScreen } from "../lib/assistant-context";
import { FONT_FAMILY } from "../theme/tokens";
import { useAppTheme } from "../theme/use-app-theme";
import { SoftPressable, useWorkspaceReducedMotion } from "./workspace-motion";

type Message = AssistantHistory & { source?: "gemini" | "local"; actions?: AssistantResponse["actions"] };
const AssistantContext = createContext<((screen: AssistantScreen) => void) | null>(null);

export function AssistantButton({ screen }: { screen?: AssistantScreen }) {
  const open = useContext(AssistantContext);
  const pathname = usePathname();
  const { workspace } = useAppTheme();
  if (!open) return null;
  return <SoftPressable accessibilityRole="button" accessibilityLabel="Abrir assistente Vuvu" testID="assistant-open" onPress={() => open(screen ?? assistantScreen(pathname))} style={[styles.launcher, { borderColor: workspace.line, backgroundColor: workspace.neutralTint }]}><Ionicons name="chatbubble-ellipses-outline" size={20} color={workspace.lavender} /></SoftPressable>;
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
      setMessages((previous) => [...previous, { role: "user", content: question }, { role: "assistant", content: response.message, source: response.source, actions: Array.isArray(response.actions) ? response.actions : [] }]);
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
    <Modal visible={visible} animationType={reduced ? "none" : "slide"} onRequestClose={() => setVisible(false)}>
      <SafeAreaView style={[styles.screen, { backgroundColor: workspace.background }]}>
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={[styles.header, { borderBottomColor: workspace.line }]}><View style={{ flex: 1 }}><Text accessibilityRole="header" style={ui.heading}>Vuvu</Text><Text style={ui.muted}>Assistente Vulnera</Text></View><SoftPressable accessibilityRole="button" accessibilityLabel="Fechar assistente" onPress={() => setVisible(false)} style={styles.icon}><Ionicons name="close" size={23} color={workspace.text} /></SoftPressable></View>
          <ScrollView ref={scroll} style={styles.flex} contentContainerStyle={styles.messages} keyboardShouldPersistTaps="handled" onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: !reduced })}>
            <Text style={ui.muted}>Sua pergunta e parte da conversa são enviadas ao assistente. Evite incluir dados sensíveis.</Text>
            {!messages.length && !pendingText && <Text style={ui.body}>Olá! Como posso ajudar você a usar o Vulnera?</Text>}
            {messages.map((item, index) => <View key={index} style={[styles.message, { backgroundColor: item.role === "user" ? workspace.chipActiveBg : workspace.inset }]}><Text style={ui.eyebrow}>{item.role === "user" ? "VOCÊ" : `VUVU · ${item.source === "gemini" ? "IA" : "AJUDA LOCAL"}`}</Text><Text selectable style={ui.body}>{item.content}</Text>{item.actions?.map((action) => {
              if (!Object.prototype.hasOwnProperty.call(assistantActions, action.id)) return null;
              const destination = assistantActions[action.id as AssistantActionId];
              return <SoftPressable key={action.id} accessibilityRole="button" onPress={() => { setVisible(false); router.push(destination.path as Href); }} style={[styles.action, { borderColor: workspace.actionBorder }]}><Text style={[ui.body, { color: workspace.lavender }]}>{destination.label}</Text></SoftPressable>;
            })}</View>)}
            {pendingText && <View style={[styles.message, { backgroundColor: workspace.chipActiveBg }]}><Text style={ui.eyebrow}>VOCÊ</Text><Text style={ui.body}>{pendingText}</Text></View>}
            {pending && <View style={styles.waiting} accessibilityLiveRegion="polite"><ActivityIndicator color={workspace.lavender} /><Text style={ui.muted}>Vuvu está respondendo...</Text></View>}
            {error && <Text accessibilityRole="alert" style={[ui.body, { color: workspace.dangerInk }]}>{error}</Text>}
          </ScrollView>
          <View style={[styles.composer, { borderTopColor: workspace.line }]}><TextInput accessibilityLabel="Pergunta para Vuvu" multiline maxLength={1000} value={draft} editable={!pending} onChangeText={setDraft} placeholder="Digite sua pergunta" placeholderTextColor={workspace.muted} style={[styles.input, { color: workspace.text, backgroundColor: workspace.inset, borderColor: workspace.line }]} /><SoftPressable accessibilityRole="button" accessibilityLabel="Enviar pergunta" accessibilityState={{ disabled: pending || !draft.trim() }} disabled={pending || !draft.trim()} onPress={() => { void send(); }} style={[styles.send, { backgroundColor: workspace.actionBg, opacity: pending || !draft.trim() ? 0.5 : 1 }]}><Ionicons name="send" size={20} color={workspace.lavender} /></SoftPressable></View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  </AssistantContext.Provider>;
}

type ComponentRefScroll = ComponentRef<typeof ScrollView>;
const styles = StyleSheet.create({
  launcher: { width: 48, height: 48, borderRadius: 18, borderWidth: 1, alignItems: "center", justifyContent: "center" }, screen: { flex: 1 }, flex: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 10, borderBottomWidth: 1 }, icon: { width: 48, height: 48, alignItems: "center", justifyContent: "center" },
  messages: { gap: 12, padding: 20 }, message: { borderRadius: 18, padding: 14, gap: 8 }, waiting: { flexDirection: "row", gap: 8, alignItems: "center" }, action: { minHeight: 48, justifyContent: "center", borderTopWidth: 1 },
  composer: { flexDirection: "row", alignItems: "flex-end", padding: 12, gap: 8, borderTopWidth: 1 }, input: { flex: 1, minHeight: 48, maxHeight: 120, borderWidth: 1, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12, fontFamily: FONT_FAMILY.regular, fontSize: 15 }, send: { width: 48, height: 48, borderRadius: 16, alignItems: "center", justifyContent: "center" },
});
