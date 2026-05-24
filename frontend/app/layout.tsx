export const metadata = {
  title: 'OsteoAI Platform',
  description: 'Phase 1 Data Collection System',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  )
}