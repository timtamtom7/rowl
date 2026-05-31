import { memo } from "react";
import { CopyIcon, CheckIcon } from "lucide-react";
import { useAppSettings } from "~/appSettings";
import { Button } from "../ui/button";
import { useCopyToClipboard } from "~/hooks/useCopyToClipboard";
import { cn } from "~/lib/utils";

export const MessageCopyButton = memo(function MessageCopyButton({
  text,
  className,
}: {
  text: string;
  className?: string | undefined;
}) {
  const {
    settings: { language },
  } = useAppSettings();
  const { copyToClipboard, isCopied } = useCopyToClipboard();
  const title = language === "fa" ? "کپی پیام" : "Copy message";

  return (
    <Button
      type="button"
      size="xs"
      variant="outline"
      onClick={() => copyToClipboard(text)}
      aria-label={title}
      title={title}
      className={cn(
        "app-interactive-motion border-border/55 bg-background/70 text-muted-foreground/72 shadow-sm hover:bg-background hover:text-foreground",
        className,
      )}
    >
      {isCopied ? <CheckIcon className="size-3 text-success" /> : <CopyIcon className="size-3" />}
    </Button>
  );
});
