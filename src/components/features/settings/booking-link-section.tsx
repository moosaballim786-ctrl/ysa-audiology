"use client";
import { toast } from "sonner";
import { Copy, ExternalLink } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { siteUrl } from "./practice-section";

function copy(text: string) {
  navigator.clipboard.writeText(text).then(
    () => toast.success("Copied"),
    () => toast.error("Couldn't copy — select the text and copy it manually"),
  );
}

export function BookingLinkSection() {
  const base = siteUrl();
  const link = `${base}/book`;
  const button = `<a href="${link}" target="_blank" rel="noopener" style="display:inline-block;padding:14px 26px;border-radius:14px;background:#2A7F8F;color:#fff;font:600 16px/1.2 system-ui,sans-serif;text-decoration:none">Book an appointment</a>`;
  const iframe = `<iframe src="${link}?embed=1" title="Book an appointment — Yusuf Suder Audiology" style="width:100%;max-width:760px;height:900px;border:0;border-radius:20px" loading="lazy"></iframe>`;

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader label="Booking page" title="Public booking link" />
        <CardBody className="space-y-3">
          <p className="text-[14px] text-muted">Patients book here without logging in. Link it from the practice website&rsquo;s &ldquo;Book an appointment&rdquo; button.</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <code className="flex h-11 flex-1 items-center overflow-x-auto rounded-xl border border-border bg-bg-alt px-3.5 text-[13.5px] text-heading">{link}</code>
            <Button variant="secondary" onClick={() => copy(link)}>
              <Copy /> Copy
            </Button>
            <Button asChild variant="soft">
              <a href="/book" target="_blank" rel="noopener">
                <ExternalLink /> Open
              </a>
            </Button>
          </div>
          <p className="text-[12.5px] text-muted">The base address comes from the NEXT_PUBLIC_SITE_URL setting, so it can move to ysa-is-hear.co.za later without code changes.</p>
        </CardBody>
      </Card>
      <Card>
        <CardHeader label="Website" title="“Book an appointment” button" />
        <CardBody className="space-y-3">
          <pre className="overflow-x-auto whitespace-pre-wrap break-all rounded-xl border border-border bg-bg-alt p-3.5 text-[12.5px] text-heading">{button}</pre>
          <Button variant="secondary" onClick={() => copy(button)}>
            <Copy /> Copy button code
          </Button>
        </CardBody>
      </Card>
      <Card>
        <CardHeader label="Website" title="Embed the booking form" />
        <CardBody className="space-y-3">
          <pre className="overflow-x-auto whitespace-pre-wrap break-all rounded-xl border border-border bg-bg-alt p-3.5 text-[12.5px] text-heading">{iframe}</pre>
          <Button variant="secondary" onClick={() => copy(iframe)}>
            <Copy /> Copy embed code
          </Button>
        </CardBody>
      </Card>
    </div>
  );
}
