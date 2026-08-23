type CubeSource = {
    px: unknown;
    nx: unknown;
    py: unknown;
    ny: unknown;
    pz: unknown;
    nz: unknown;
};
type Props = {
    source?: Partial<CubeSource>;
    onLoadEnd?: () => void;
    onError?: (error: unknown) => void;
    [key: string]: any;
};
export declare function ViroSkyBox(props: Props): null;
export {};
