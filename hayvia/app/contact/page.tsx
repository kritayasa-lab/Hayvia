import type { Metadata } from "next";
import Container from "@/components/ui/Container";
import ContactButtons from "@/components/forms/ContactButtons";
import ContactForm from "@/components/forms/ContactForm";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Get in touch with HAYVIA — questions about renting, looking for a property, or want to list your own.",
};

export default function ContactPage() {
  return (
    <Container className="py-10 sm:py-14">
      <div className="max-w-2xl">
        <h1 className="font-display text-3xl text-ink sm:text-4xl">Get in touch</h1>
        <p className="mt-3 text-ink-soft">
          Questions? Looking for a property? Want to list a property? Reach us however
          is easiest for you.
        </p>
      </div>

      <div className="mt-10 grid grid-cols-1 gap-12 lg:grid-cols-2">
        <div>
          <h2 className="font-display text-lg text-ink">Message us directly</h2>
          <div className="mt-4">
            <ContactButtons />
          </div>
        </div>

        <div>
          <h2 className="font-display text-lg text-ink">Or send a message</h2>
          <div className="mt-4 rounded border border-line bg-surface p-6">
            <ContactForm />
          </div>
        </div>
      </div>
    </Container>
  );
}
