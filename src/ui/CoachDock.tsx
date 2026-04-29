import { useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { ArrowRight, Mic, Sparkles } from "lucide-react-native";

import { answerCoachQuestion, type TrainingPlan } from "../coach/planEngine";
import { styles } from "../styles/appStyles";
import { tokens } from "../theme/tokens";

type CoachMessage = {
  id: string;
  role: "user" | "coach";
  text: string;
};

export function CoachDock({ plan }: { plan: TrainingPlan }) {
  const [collapsed, setCollapsed] = useState(false);
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<CoachMessage[]>([]);

  function send() {
    const question = draft.trim();
    if (!question) return;

    const answer = answerCoachQuestion(question, plan);
    setMessages((current) => [
      ...current,
      { id: `${Date.now()}-user`, role: "user", text: question },
      { id: `${Date.now()}-coach`, role: "coach", text: answer },
    ]);
    setDraft("");
    setCollapsed(false);
  }

  if (collapsed) {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={() => setCollapsed(false)}
        style={styles.coachBubbleButton}
      >
        <Sparkles color={tokens.surface} size={18} strokeWidth={2} />
      </Pressable>
    );
  }

  return (
    <View style={styles.coachDock}>
      {messages.length ? (
        <ScrollView
          contentContainerStyle={styles.coachDockMessages}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          style={styles.coachDockMessagesScroll}
        >
          {messages.slice(-4).map((message) => (
            <View
              key={message.id}
              style={[
                styles.coachDockMessage,
                message.role === "user" && styles.coachDockMessageUser,
              ]}
            >
              <Text
                style={[
                  styles.coachDockMessageText,
                  message.role === "user" && styles.coachDockMessageTextUser,
                ]}
              >
                {message.text}
              </Text>
            </View>
          ))}
        </ScrollView>
      ) : null}
      <View style={styles.coachDockInputRow}>
        <Sparkles color={tokens.accent} size={15} strokeWidth={2} />
        <TextInput
          cursorColor={tokens.accent}
          onChangeText={setDraft}
          onSubmitEditing={send}
          placeholder="Ask about today or the week..."
          placeholderTextColor={tokens.muted}
          returnKeyType="send"
          selectionColor={tokens.accent}
          style={styles.coachDockInput}
          value={draft}
        />
        <Mic color={tokens.muted} size={15} strokeWidth={2} />
        <Pressable
          accessibilityLabel={
            draft.trim() ? "Send coach question" : "Collapse coach chat"
          }
          accessibilityRole="button"
          onPress={draft.trim() ? send : () => setCollapsed(true)}
          style={[
            styles.coachDockSend,
            !draft.trim() && styles.coachDockCollapse,
          ]}
        >
          <ArrowRight
            color={draft.trim() ? tokens.surface : tokens.muted}
            size={18}
            strokeWidth={2.2}
          />
        </Pressable>
      </View>
    </View>
  );
}
