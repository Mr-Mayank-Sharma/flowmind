import { DOMParser } from "@xmldom/xmldom";
import { Strategy as SamlStrategy, SamlConfig, VerifyWithoutRequest, Profile, SAML } from "passport-saml";

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

export interface OrgSamlConfig {
  idpEntityId?: string;
  idpSsoUrl?: string;
  idpCertificate?: string;
  attributeMapping?: { email?: string; name?: string };
}

function getTagAttribute(doc: XMLDocument, localName: string, attribute: string): string | null {
  const elements = doc.getElementsByTagNameNS("*", localName);
  const el = elements.length > 0 ? elements[0] : doc.getElementsByTagName(localName)[0];
  return el?.getAttribute(attribute) ?? null;
}

function parseIdpMetadata(xml: string): IdpMetadata {
  let doc: XMLDocument;
  try {
    doc = new DOMParser().parseFromString(xml, "text/xml") as unknown as XMLDocument;
  } catch {
    throw new Error("Invalid SAML metadata: XML parsing failed");
  }

  const entryPoint = getTagAttribute(doc, "SingleSignOnService", "Location");
  const logoutUrl = getTagAttribute(doc, "SingleLogoutService", "Location") || undefined;
  const issuer = getTagAttribute(doc, "EntityDescriptor", "entityID") || "unknown-issuer";

  const certEls = doc.getElementsByTagNameNS("*", "X509Certificate");
  const certEl = certEls.length > 0 ? certEls[0] : doc.getElementsByTagName("X509Certificate")[0];
  const cert = certEl?.textContent?.replace(/\s+/g, "") || undefined;

  if (!entryPoint) {
    throw new Error("Invalid SAML metadata: missing SingleSignOnService Location");
  }

  return { entryPoint, logoutUrl, cert, issuer };
}

function normalizeCertificate(cert?: string): string | undefined {
  if (!cert) return undefined;
  const trimmed = cert.trim();
  if (trimmed.startsWith("-----BEGIN")) return trimmed;
  const body = trimmed.replace(/\s+/g, "");
  return `-----BEGIN CERTIFICATE-----\n${body}\n-----END CERTIFICATE-----`;
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

function buildSamlInstance(orgId: string, config: OrgSamlConfig): SAML {
  if (!config.idpSsoUrl) {
    throw new Error("SAML SSO URL is not configured");
  }
  return new SAML({
    callbackUrl: `${process.env.APP_URL ?? "http://localhost:3000"}/api/auth/saml/callback?orgId=${orgId}`,
    entryPoint: config.idpSsoUrl,
    issuer: `urn:flowmind:${orgId}`,
    idpIssuer: config.idpEntityId,
    cert: normalizeCertificate(config.idpCertificate) ?? "",
    acceptedClockSkewMs: 60000,
    identifierFormat: "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress",
    wantAssertionsSigned: true,
  });
}

export async function buildSamlLoginUrl(
  orgId: string,
  config: OrgSamlConfig,
  relayState: string,
): Promise<string> {
  const saml = buildSamlInstance(orgId, config);
  return saml.getAuthorizeUrlAsync(relayState, `${process.env.APP_URL ?? "http://localhost:3000"}`, {});
}

export async function validateSamlPostResponse(
  orgId: string,
  config: OrgSamlConfig,
  samlResponse: string,
  relayState?: string,
): Promise<SamlUserProfile> {
  if (!config.idpEntityId) {
    throw new Error("SAML IdP entity ID is not configured");
  }
  if (!config.idpCertificate) {
    throw new Error("SAML IdP certificate is not configured");
  }

  const saml = buildSamlInstance(orgId, config);
  const container: Record<string, string> = { SAMLResponse: samlResponse };
  if (relayState) container.RelayState = relayState;

  const { profile } = await saml.validatePostResponseAsync(container);
  if (!profile) {
    throw new Error("SAML response did not contain a valid profile");
  }

  const mapping = config.attributeMapping ?? { email: "email", name: "name" };
  const emailKey = mapping.email ?? "email";
  const nameKey = mapping.name ?? "name";

  const attributes = profile.attributes as Record<string, string | string[] | undefined> | undefined;
  const first = (v: string | string[] | undefined): string | undefined =>
    Array.isArray(v) ? v[0] : v;

  const email =
    first(attributes?.[emailKey]) ??
    (profile.nameID && profile.nameID.includes("@") ? profile.nameID : undefined) ??
    (typeof profile.email === "string" ? profile.email : undefined) ??
    "";
  const name = String(
    first(attributes?.[nameKey]) ??
    (typeof profile.displayName === "string" ? profile.displayName : undefined) ??
    (typeof profile.name === "string" ? profile.name : undefined) ??
    email.split("@")[0],
  );

  if (!email) {
    throw new Error("SAML response did not contain a valid email address");
  }

  return {
    email,
    name,
    issuer: profile.issuer ?? config.idpEntityId,
    nameId: profile.nameID ?? email,
    sessionIndex: (profile as { sessionIndex?: string }).sessionIndex ?? null,
  };
}

export { createSamlStrategy, parseIdpMetadata };
