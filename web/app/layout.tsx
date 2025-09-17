export const metadata = { title: "Rock Paper Scissor Mind Game", description: "A hybrid learner with smart prompts and psychology bluff." };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

