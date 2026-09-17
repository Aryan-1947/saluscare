import { useCallback } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { api } from "@/lib/api";
import type { AssessmentResult, ImageClarificationResult, GeneralAnswerResult } from "@/types/api";

export function useApi() {
  const { getAccessTokenSilently } = useAuth0();

  // useCallback keeps stable identities so these are safe to use in effect deps.
  const startSession = useCallback(async () => {
    const token = await getAccessTokenSilently();
    return api.sessionStart(token);
  }, [getAccessTokenSilently]);

  const sendMessage = useCallback(
    async (text: string, sessionId: string, skipClarification?: boolean) => {
      const token = await getAccessTokenSilently();
      const result = await api.sessionMessage(token, text, sessionId, skipClarification);
      return result as AssessmentResult | { sessionId: string; needsClarification: true; clarifyingQuestion: string };
    },
    [getAccessTokenSilently]
  );

  const sendImage = useCallback(
    async (
      imageBase64: string,
      imageMimeType: string,
      text: string | undefined,
      sessionId: string
    ): Promise<AssessmentResult | ImageClarificationResult> => {
      const token = await getAccessTokenSilently();
      const result = await api.sessionImage(token, imageBase64, imageMimeType, text, sessionId);
      return result as AssessmentResult | ImageClarificationResult;
    },
    [getAccessTokenSilently]
  );

  const sendFollowup = useCallback(
    async (
      text: string,
      parentSessionId: string,
      newSessionId: string,
      recentExchanges?: { question: string; answer: string }[]
    ) => {
      const token = await getAccessTokenSilently();
      const result = await api.sessionFollowup(token, text, parentSessionId, newSessionId, recentExchanges);
      return result as AssessmentResult | GeneralAnswerResult;
    },
    [getAccessTokenSilently]
  );

  const getHistory = useCallback(
    async (sessionId: string) => {
      const token = await getAccessTokenSilently();
      return api.sessionHistory(token, sessionId);
    },
    [getAccessTokenSilently]
  );

  return { startSession, sendMessage, sendImage, sendFollowup, getHistory };
}