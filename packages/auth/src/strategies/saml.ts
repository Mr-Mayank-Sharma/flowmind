import { Strategy as SamlStrategy, SamlConfig, VerifyWithoutRequest, Profile } from "passport-saml";

export interface SamlUserProfile {
  email: string;
  name: string;
  issuer: string;
  nameId: string;
  sessionIndex: string | null;
}

export interface IdpMetadata {
  entryPoint: string;
  logoutUrl?: string;
  cert?: string;
  issuer: string;
}

function parseIdpMetadata(xml: string): IdpMetadata {
  const entryPoint = extractTag(xml, "SingleSignOnService", "Location");
  const logoutUrl = extractTag(xml, "SingleLogoutService", "Location") || undefined;
  const cert = extractCertFromMetadata(xml);
  const issuer = extractTag(xml, "EntityDescriptor", "entityID");

  if (!entryPoint) {
    throw new Error("Invalid SAML metadata: missing SingleSignOnService Location");
  }

  return {
    entryPoint,
    logoutUrl,
    cert,
    issuer: issuer || "unknown-issuer",
  };
}

function extractTag(xml: string, tagName: string, attribute: string): string | null {
  const regex = new RegExp(`<${tagName}[^>]*${attribute}="([^"]*)"`, "i");
  const match = xml.match(regex);
  return match?.[1] ?? null;
}

function extractCertFromMetadata(xml: string): string | undefined {
  const match = xml.match(/<X509Certificate>([\s\S]*?)<\/X509Certificate>/i);
  if (!match?.[1]) return undefined;
  return match[1].replace(/\s+/g, "");
}

function createSamlStrategy(
  orgId: string,
  idpMetadata?: string,
): SamlStrategy {
  const metadata: IdpMetadata = idpMetadata
    ? parseIdpMetadata(idpMetadata)
    : {
        entryPoint: process.env.SAML_ENTRY_POINT ?? "",
        issuer: process.env.SAML_ISSUER ?? "flowmind",
        cert: process.env.SAML_CERT ?? undefined,
      };

  const config: SamlConfig = {
    path: "/api/auth/saml/callback",
    entryPoint: metadata.entryPoint,
    issuer: metadata.issuer,
    cert: metadata.cert ?? "",
    logoutUrl: metadata.logoutUrl,
    acceptedClockSkewMs: 60000,
    identifierFormat: "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress",
  };

  const verify: VerifyWithoutRequest = (profile: Profile | null | undefined, done) => {
    done(null, { ...profile, orgId });
  };

  return new SamlStrategy(config, verify);
}

export { createSamlStrategy, parseIdpMetadata };
