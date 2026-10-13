type SurpriseGiftIconProps = {
  emoji: string;
  imageUrl?: string;
  className?: string;
  imageClassName?: string;
};

export default function SurpriseGiftIcon({ emoji, imageUrl, className = '', imageClassName = 'h-full w-full object-contain' }: SurpriseGiftIconProps) {
  return <span className={`inline-grid shrink-0 place-items-center overflow-hidden ${className}`}>
    {imageUrl ? <img src={imageUrl} alt="" className={imageClassName} /> : emoji}
  </span>;
}
