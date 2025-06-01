interface QRiousStatic {
    new(options?: QRiousOptions): QRiousStatic;
    set(options: QRiousOptions): void;
    toDataURL(mime?: string): string;
}

declare type CorrectionLevel = 'L' | 'M' | 'Q' | 'H';

interface QRiousOptions {
    background?: string;
    backgroundAlpha?: number;
    foreground?: string,
    foregroundAlpha?: number,
    level?: CorrectionLevel;
    padding?: number,
    size?: number,
    value?: string
}


declare module "qrious" {
    export = QRious;
}

declare var QRious: QRiousStatic
