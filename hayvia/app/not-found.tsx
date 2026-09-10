import Container from "@/components/ui/Container";
import Button from "@/components/ui/Button";

export default function NotFound() {
  return (
    <Container className="flex flex-col items-center py-24 text-center">
      <p className="font-display text-5xl text-moss-300">404</p>
      <h1 className="mt-4 font-display text-2xl text-ink">Page not found</h1>
      <p className="mt-2 max-w-sm text-ink-soft">
        The page you're looking for doesn't exist or may have moved.
      </p>
      <div className="mt-6 flex gap-3">
        <Button href="/">Back to Home</Button>
        <Button href="/properties" variant="secondary">
          Browse Properties
        </Button>
      </div>
    </Container>
  );
}
