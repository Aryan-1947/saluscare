import { Auth0Provider } from "@auth0/auth0-react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";

// Must be rendered INSIDE <BrowserRouter> so it can navigate after the callback.
export function AppAuth0Provider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();

  const domain = import.meta.env.VITE_AUTH0_DOMAIN;
  const clientId = import.meta.env.VITE_AUTH0_CLIENT_ID;
  const audience = import.meta.env.VITE_AUTH0_AUDIENCE;

  return (
    <Auth0Provider
      domain={domain}
      clientId={clientId}
      authorizationParams={{
        redirect_uri: window.location.origin,
        audience: audience,
      }}
      // Client-side navigation back to the page the user originally requested.
      // IMPORTANT: never window.location.replace() here — a full reload wipes the
      // in-memory token cache and sends the user back to the login screen.
      onRedirectCallback={(appState) => {
        navigate(appState?.returnTo ?? "/ask", { replace: true });
      }}
      // Refresh tokens + localStorage let the session survive full page reloads
      // without hidden-iframe silent auth, which modern browsers block
      // (third-party cookie deprecation) — the usual cause of login loops.
      useRefreshTokens
      cacheLocation="localstorage"
    >
      {children}
    </Auth0Provider>
  );
}