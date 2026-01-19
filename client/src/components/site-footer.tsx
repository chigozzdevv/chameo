import Image from "next/image";

export default function SiteFooter() {
  return (
    <footer className="mx-auto max-w-5xl text-xs text-slate-500">
      <div className="flex flex-col items-center justify-between gap-3 text-center sm:flex-row sm:text-left">
        <div className="relative h-12 w-56 sm:h-16 sm:w-72">
          <Image
            src="/chameo-logo.png"
            alt="Chameo"
            fill
            className="object-contain"
            sizes="(min-width: 640px) 288px, 224px"
          />
        </div>
        <span>Compliant private payouts on Solana.</span>
        <span className="text-slate-400">© 2026</span>
      </div>
    </footer>
  );
}
