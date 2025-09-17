export const metadata = { title: "RPS • ML", description: "Rock • Paper • Scissors • Science" };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}