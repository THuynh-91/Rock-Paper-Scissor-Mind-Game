export const metadata = { title: "RPS • ML", description: "Rock • Paper • Scissors • Mind Game" };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}