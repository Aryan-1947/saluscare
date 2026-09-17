import { Auth0Provider } from "@auth0/auth0-react";
import type { ReactNode } from "react";

export function AppAuth0Provider({ children }: { children: ReactNode }) {
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
      onRedirectCallback={(appState) => {
        // Send the user back to the page they originally requested before login
        window.location.replace(appState?.returnTo ?? window.location.origin);
      }}
    >
      {children}
    </Auth0Provider>
  );
}