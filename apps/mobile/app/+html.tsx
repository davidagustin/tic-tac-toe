// Customizes the root HTML document for Expo web builds.
// Sets proper viewport scaling so buttons/text render at intended
// sizes on mobile browsers instead of appearing tiny.

const webStyles = `html, body { -webkit-text-size-adjust: 100%; height: 100%; overflow: hidden; }
#root { display: flex; height: 100%; }`;

export default function Root({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, shrink-to-fit=no, viewport-fit=cover"
        />
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: static styles, no user input */}
        <style dangerouslySetInnerHTML={{ __html: webStyles }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
