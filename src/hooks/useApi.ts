import { useCallback } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { api } from "@/lib/api";
import type {
  AssessmentResult,
  ImageClarificationResult,
  GeneralAnswerResult,
  DoctorSummaryResponse,
  HistoryResponse,
  FollowupsResponse,
  SummariesResponse,
} from "@/types/api";

/**
 * A cached login created before refresh tokens were enabled has no refresh
 * token stored, so silent renewal fails with "Missing Refresh Token" (or
 * Auth0's interactive-renewal errors). The only cure is a fresh login: clear
 * the stale SDK cache and restart on /login.
 */
export function isRecoverableAuthError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  return (
    /missing refresh token/i.test(msg) ||
    /login_required/i.test(msg) ||
    /consent_required/i.test(msg) ||
    /invalid_grant/i.test(msg)
  );
}

function hardResetAuth(): void {
  try {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith("@@auth0spajs@@") || /auth0/i.test(key)) {
        localStorage.removeItem(key);
      }
    }
  } catch {
    // localStorage unavailable (private mode) - the reload alone usually heals.
  }
  // Full reload, not client-side navigation: the SDK must rebuild its
  // in-memory state from the now-empty cache.
  window.location.assign("/login");
}

export function useApi() {
  const { getAccessTokenSilently } = useAuth0();

  // Token fetch with self-healing: a stale pre-refresh-token cache triggers a
  // clean re-login instead of failing every API call with a cryptic error.
  const getToken = useCallback(async () => {
    try {
      return await getAccessTokenSilently();
    } catch (err) {
      if (isRecoverableAuthError(err)) hardResetAuth();
      throw err;
    }
  }, [getAccessTokenSilently]);

  // useCallback keeps stable identities so these are safe to use in effect deps.
  const startSession = useCallback(async () => {
    const token = await getToken();
    return api.sessionStart(token);
  }, [getToken]);

  const sendMessage = useCallback(
    async (text: string, sessionId: string, skipClarification?: boolean) => {
      const token = await getToken();
      const result = await api.sessionMessage(token, text, sessionId, skipClarification);
      return result as AssessmentResult | { sessionId: string; needsClarification: true; clarifyingQuestion: string };
    },
    [getToken]
  );

  const sendImage = useCallback(
    async (
      imageBase64: string,
      imageMimeType: string,
      text: string | undefined,
      sessionId: string
    ): Promise<AssessmentResult | ImageClarificationResult> => {
      const token = await getToken();
      const result = await api.sessionImage(token, imageBase64, imageMimeType, text, sessionId);
      return result as AssessmentResult | ImageClarificationResult;
    },
    [getToken]
  );

  const sendAnswerWithImage = useCallback(
    async (
      text: string,
      sessionId: string,
      hasImage: boolean,
      imageQualityGood: boolean,
      skipClarification?: boolean
    ) => {
      const token = await getToken();
      const result = await api.sessionMessageWithImageContext(
        token,
        text,
        sessionId,
        hasImage,
        imageQualityGood,
        skipClarification
      );
      return result as AssessmentResult | { sessionId: string; needsClarification: true; clarifyingQuestion: string };
    },
    [getToken]
  );

  const getHistory = useCallback(
    async (sessionId: string): Promise<HistoryResponse> => {
      const token = await getToken();
      return api.sessionHistory(token, sessionId);
    },
    [getToken]
  );

  const sendFollowup = useCallback(
    async (
      text: string,
      parentSessionId: string,
      newSessionId: string,
      recentExchanges?: { question: string; answer: string }[]
    ) => {
      const token = await getToken();
      const result = await api.sessionFollowup(token, text, parentSessionId, newSessionId, recentExchanges);
      return result as AssessmentResult | GeneralAnswerResult;
    },
    [getToken]
  );



  const getFollowups = useCallback(
    async (limit?: number): Promise<FollowupsResponse> => {
      const token = await getToken();
      return api.sessionFollowups(token, limit);
    },
    [getToken]
  );

  const getSummaries = useCallback(
    async (sessionIds: string[]): Promise<SummariesResponse> => {
      const token = await getToken();
      return api.sessionSummaries(token, sessionIds);
    },
    [getToken]
  );

  const getDoctorSummary = useCallback(
    async (sessionId: string): Promise<DoctorSummaryResponse> => {
      const token = await getToken();
      return api.sessionDoctorSummary(token, sessionId);
    },
    [getToken]
  );

  return {
    startSession,
    sendMessage,
    sendImage,
    sendAnswerWithImage,
    sendFollowup,
    getHistory,
    getFollowups,
    getSummaries,
    getDoctorSummary,
  };
}