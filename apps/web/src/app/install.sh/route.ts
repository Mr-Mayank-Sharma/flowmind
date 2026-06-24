import { readFileSync } from "fs"
import { join } from "path"
import { NextResponse } from "next/server"

export const dynamic = "force-static"

export async function GET() {
  const filePath = join(process.cwd(), "../../../install.sh")
  try {
    const content = readFileSync(filePath, "utf-8")
    return new NextResponse(content, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "public, max-age=3600",
      },
    })
  } catch {
    return new NextResponse("#!/usr/bin/env bash\necho 'Install script coming soon.'\n", {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    })
  }
}
