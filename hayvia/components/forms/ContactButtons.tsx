import { MessageCircle, Mail, Facebook } from "lucide-react";
import { contactConfig } from "@/config/contact";

const buttons = [
  {
    label: "WhatsApp",
    description: "Fastest response, especially for international visitors",
    href: contactConfig.whatsappLink,
    icon: MessageCircle,
  },
  {
    label: "LINE",
    description: `Message us at ${contactConfig.lineId}`,
    href: contactConfig.lineLink,
    icon: MessageCircle,
  },
  {
    label: "Email",
    description: contactConfig.email,
    href: contactConfig.emailLink,
    icon: Mail,
  },
  {
    label: "Facebook",
    description: "Message our page",
    href: contactConfig.facebookLink,
    icon: Facebook,
  },
];

export default function ContactButtons() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {buttons.map((button) => (
        <a
          key={button.label}
          href={button.href}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-start gap-4 rounded border border-line bg-surface p-5 transition-colors hover:border-moss-400"
        >
          <span className="mt-0.5 inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-moss-50 text-moss-700">
            <button.icon size={18} />
          </span>
          <span>
            <span className="block font-medium text-ink">{button.label}</span>
            <span className="mt-0.5 block text-sm text-ink-soft">{button.description}</span>
          </span>
        </a>
      ))}
    </div>
  );
}
