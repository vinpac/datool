import type { Metadata } from "next"

import "./globals.css"

export const metadata: Metadata = {
  title: "Datool React Query Demo",
  description: "Next.js example for the registry-installed React Query Datool components.",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
