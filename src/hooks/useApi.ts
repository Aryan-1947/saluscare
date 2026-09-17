import { useAuth0 } from "@auth0/auth0-react";
import { api } from "@/lib/api";
import type { AssessmentResult, ImageClarificationResult, GeneralAnswerResult } from "@/types/api";

export function useApi() {
  const { getAccessTokenSilently } = useAuth0();

  const startSession = async () => {
    const token = await getAccessTokenSilently();
    return api.sessionStart(token);
  };

  const sendMessage = async (text: string, sessionId: string, skipClarification?: boolean) => {
    const token = await getAccessTokenSilently();
    const result = await api.sessionMessage(token, text, sessionId, skipClarification);
    return result as AssessmentResult | { sessionId: string; needsClarification: true; clarifyingQuestion: string };
  };

  const sendImage = async (
    imageBase64: string,
    imageMimeType: string,
    text: string | undefined,
    sessionId: string
  ): Promise<AssessmentResult | ImageClarificationResult> => {
    const token = await getAccessTokenSilently();
    const result = await api.sessionImage(token, imageBase64, imageMimeType, text, sessionId);
    return result as AssessmentResult | ImageClarificationResult;
  };

  const sendFollowup = async (
    text: string,
    parentSessionId: string,
    newSessionId: string,
    recentExchanges?: { question: string; answer: string }[]
  ) => {
    const token = await getAccessTokenSilently();
    const result = await api.sessionFollowup(token, text, parentSessionId, newSessionId, recentExchanges);
    return result as AssessmentResult | GeneralAnswerResult;
  };

  const getHistory = async (sessionId: string) => {
    const token = await getAccessTokenSilently();
    return api.sessionHistory(token, sessionId);
  };

  return { startSession, sendMessage, sendImage, sendFollowup, getHistory };
}