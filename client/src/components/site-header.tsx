import Image from "next/image";

export default function SiteHeader() {
  return (
    <header className="flex items-center justify-center">
      <div className="relative h-14 w-48">
        <Image
          src="/chameo-logo.png"
          alt="chameo.cash"
          fill
          priority
          className="object-cover object-center drop-shadow-sm"
          sizes="192px"
        />
      </div>
    </header>
  );
}
