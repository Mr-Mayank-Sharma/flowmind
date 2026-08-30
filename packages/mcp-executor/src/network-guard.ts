import dns from "node:dns/promises"
import { isIP } from "node:net"
import { URL } from "node:url"

export class BlockedUrlError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "BlockedUrlError"
  }
}

function ipv4ToLong(ip: string): number {
  const parts = ip.split(".").map((p) => parseInt(p, 10))
  const a = parts[0] ?? 0
  const b = parts[1] ?? 0
  const c = parts[2] ?? 0
  const d = parts[3] ?? 0
  return (((a << 24) | (b << 16) | (c << 8) | d) >>> 0)
}

function blockedIpv4Range(ip: string): string | null {
  const n = ipv4ToLong(ip)
  if (((n & 0xff000000) >>> 0) === 0x00000000) return "0.0.0.0/8"
  if (((n & 0xff000000) >>> 0) === 0x0a000000) return "10.0.0.0/8"
  if (((n & 0xffc00000) >>> 0) === 0x64400000) return "100.64.0.0/10"
  if (((n & 0xff000000) >>> 0) === 0x7f000000) return "127.0.0.0/8"
  if (((n & 0xffff0000) >>> 0) === 0xa9fe0000) return "169.254.0.0/16"
  if (((n & 0xfff00000) >>> 0) === 0xac100000) return "172.16.0.0/12"
  if (((n & 0xffff0000) >>> 0) === 0xc0a80000) return "192.168.0.0/16"
  return null
}

function ipv6ToBigInt(ip: string): bigint {
  let addr = ip.trim().toLowerCase()
  if (addr.includes(".")) {
    const lastColon = addr.lastIndexOf(":")
    const v4 = addr.slice(lastColon + 1)
    const parts = v4.split(".").map((p) => parseInt(p, 10))
    const hi = (((parts[0] ?? 0) << 8) | (parts[1] ?? 0))
    const lo = (((parts[2] ?? 0) << 8) | (parts[3] ?? 0))
    addr = addr.slice(0, lastColon + 1) + hi.toString(16) + ":" + lo.toString(16)
  }
  const doubleColon = addr.indexOf("::")
  let groups: string[]
  if (doubleColon !== -1) {
    const left = addr.slice(0, doubleColon).split(":").filter(Boolean)
    const right = addr.slice(doubleColon + 2).split(":").filter(Boolean)
    const missing = 8 - left.length - right.length
    groups = [...left, ...Array(Math.max(missing, 0)).fill("0"), ...right]
  } else {
    groups = addr.split(":")
  }
  let result = BigInt(0)
  for (const g of groups) {
    result = (result << BigInt(16)) | BigInt(parseInt(g || "0", 16))
  }
  return result
}

function blockedIpv6Range(ip: string): string | null {
  const n = ipv6ToBigInt(ip)
  if (n === BigInt(1)) return "::1"
  if (n === BigInt(0)) return "::/128"

  // IPv4-mapped addresses (::ffff:a.b.c.d) re-route to the embedded IPv4.
  const high32 = Number((n >> BigInt(32)) & BigInt(0xffffffff))
  if (high32 === 0xffff) {
    const low32 = Number(n & BigInt(0xffffffff))
    const v4 = `${(low32 >>> 24) & 0xff}.${(low32 >>> 16) & 0xff}.${(low32 >>> 8) & 0xff}.${low32 & 0xff}`
    const mappedReason = blockedIpv4Range(v4)
    if (mappedReason) return `ipv4-mapped (${mappedReason})`
  }

  const first16 = Number((n >> BigInt(112)) & BigInt(0xffff))
  const firstOctet = first16 >>> 8
  if ((firstOctet & 0xfe) === 0xfc) return "fc00::/7"
  if ((first16 & 0xffc0) === 0xfe80) return "fe80::/10"
  return null
}

/**
 * Assert a URL is a public http/https endpoint: parseable, correct scheme, and the
 * host does not resolve to any private/loopback/link-local range. When `allowPrivate`
 * is true (explicit operator opt-in), the range checks are skipped. `file://` and
 * other non-http schemes are always refused.
 */
export async function assertPublicHttpUrl(rawUrl: string, allowPrivate: boolean): Promise<URL> {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    throw new BlockedUrlError("Invalid URL")
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new BlockedUrlError(`Only http/https URLs are allowed (got "${url.protocol}")`)
  }
  if (allowPrivate) return url

  const hostname = url.hostname.replace(/^\[|\]$/g, "")
  const ipVersion = isIP(hostname)

  const reject = (ip: string, reason: string) => {
    throw new BlockedUrlError(`Blocked potentially unsafe host: "${hostname}" resolves to ${ip} (${reason})`)
  }

  if (ipVersion === 4) {
    const reason = blockedIpv4Range(hostname)
    if (reason) reject(hostname, reason)
    return url
  }
  if (ipVersion === 6) {
    const reason = blockedIpv6Range(hostname)
    if (reason) reject(hostname, reason)
    return url
  }

  let addresses: Array<{ address: string; family: number }>
  try {
    const lookup = dns.lookup(hostname, { all: true })
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new BlockedUrlError(`DNS lookup for "${hostname}" timed out`)), 3000),
    )
    addresses = await Promise.race([lookup, timeout])
  } catch (err) {
    if (err instanceof BlockedUrlError) throw err
    throw new BlockedUrlError(`Unable to resolve host "${hostname}"`)
  }
  for (const address of addresses) {
    const v4 = blockedIpv4Range(address.address)
    if (v4) reject(address.address, v4)
    const v6 = blockedIpv6Range(address.address)
    if (v6) reject(address.address, v6)
  }
  return url
}