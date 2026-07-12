import { describe, it, expect } from "vitest";
import { parseIdpMetadata } from "../strategies/saml";

describe("SAML - parseIdpMetadata", () => {
  it("parses valid SAML metadata correctly", () => {
    const xml = `<?xml version="1.0"?>
<EntityDescriptor entityID="https://idp.example.com">
  <IDPSSODescriptor>
    <SingleSignOnService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect" Location="https://idp.example.com/sso"/>
    <SingleLogoutService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect" Location="https://idp.example.com/slo"/>
    <KeyDescriptor>
      <KeyInfo>
        <X509Data>
          <X509Certificate>MIIDazCCAlMCFQa0sG7X3xK7qF9kP7m5vL8R3j0=</X509Certificate>
        </X509Data>
      </KeyInfo>
    </KeyDescriptor>
  </IDPSSODescriptor>
</EntityDescriptor>`;

    const result = parseIdpMetadata(xml);
    expect(result.entryPoint).toBe("https://idp.example.com/sso");
    expect(result.logoutUrl).toBe("https://idp.example.com/slo");
    expect(result.issuer).toBe("https://idp.example.com");
    expect(result.cert).toBe("MIIDazCCAlMCFQa0sG7X3xK7qF9kP7m5vL8R3j0=");
  });

  it("throws on missing SingleSignOnService", () => {
    const xml = `<?xml version="1.0"?>
<EntityDescriptor entityID="https://idp.example.com">
  <IDPSSODescriptor>
    <SingleLogoutService Location="https://idp.example.com/slo"/>
  </IDPSSODescriptor>
</EntityDescriptor>`;

    expect(() => parseIdpMetadata(xml)).toThrow("missing SingleSignOnService Location");
  });

  it("rejects completely invalid XML with XML parsing error", () => {
    expect(() => parseIdpMetadata("not xml at all")).toThrow("XML parsing failed");
  });

  it("handles adversarial metadata with deeply nested entities", () => {
    const xml = `<?xml version="1.0"?>
<!DOCTYPE foo [
  <!ENTITY xxe SYSTEM "file:///etc/passwd">
]>
<EntityDescriptor entityID="test">
  <IDPSSODescriptor>
    <SingleSignOnService Location="https://idp.example.com/sso"/>
  </IDPSSODescriptor>
</EntityDescriptor>`;

    expect(() => parseIdpMetadata(xml)).not.toThrow();
    const result = parseIdpMetadata(xml);
    expect(result.entryPoint).toBe("https://idp.example.com/sso");
  });

  it("falls back to unknown-issuer when EntityDescriptor lacks entityID", () => {
    const xml = `<?xml version="1.0"?>
<EntityDescriptor>
  <IDPSSODescriptor>
    <SingleSignOnService Location="https://idp.example.com/sso"/>
  </IDPSSODescriptor>
</EntityDescriptor>`;

    const result = parseIdpMetadata(xml);
    expect(result.issuer).toBe("unknown-issuer");
  });

  it("handles missing certificate gracefully", () => {
    const xml = `<?xml version="1.0"?>
<EntityDescriptor entityID="https://idp.example.com">
  <IDPSSODescriptor>
    <SingleSignOnService Location="https://idp.example.com/sso"/>
  </IDPSSODescriptor>
</EntityDescriptor>`;

    const result = parseIdpMetadata(xml);
    expect(result.cert).toBeUndefined();
  });
});
