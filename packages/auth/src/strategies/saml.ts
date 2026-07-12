import { DOMParser } from "@xmldom/xmldom";
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
