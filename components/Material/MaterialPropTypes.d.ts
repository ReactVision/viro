import PropTypes from "prop-types";
export declare const MaterialPropTypes: {
    shininess: PropTypes.Requireable<number>;
    fresnelExponent: PropTypes.Requireable<number>;
    lightingModel: PropTypes.Requireable<string>;
    writesToDepthBuffer: PropTypes.Requireable<boolean>;
    readsFromDepthBuffer: PropTypes.Requireable<boolean>;
    colorWriteMask: PropTypes.Requireable<(string | null | undefined)[]>;
    cullMode: PropTypes.Requireable<string>;
    blendMode: PropTypes.Requireable<string>;
    diffuseTexture: PropTypes.Requireable<any>;
    diffuseIntensity: PropTypes.Requireable<number>;
    specularTexture: PropTypes.Requireable<any>;
    normalTexture: PropTypes.Requireable<any>;
    reflectiveTexture: PropTypes.Requireable<PropTypes.InferProps<{
        nx: PropTypes.Validator<number | PropTypes.InferProps<{
            uri: PropTypes.Requireable<string>;
        }>>;
        px: PropTypes.Validator<number | PropTypes.InferProps<{
            uri: PropTypes.Requireable<string>;
        }>>;
        ny: PropTypes.Validator<number | PropTypes.InferProps<{
            uri: PropTypes.Requireable<string>;
        }>>;
        py: PropTypes.Validator<number | PropTypes.InferProps<{
            uri: PropTypes.Requireable<string>;
        }>>;
        nz: PropTypes.Validator<number | PropTypes.InferProps<{
            uri: PropTypes.Requireable<string>;
        }>>;
        pz: PropTypes.Validator<number | PropTypes.InferProps<{
            uri: PropTypes.Requireable<string>;
        }>>;
    }>>;
    diffuseColor: any;
    chromaKeyFilteringColor: any;
    wrapS: PropTypes.Requireable<string>;
    wrapT: PropTypes.Requireable<string>;
    minificationFilter: PropTypes.Requireable<string>;
    magnificationFilter: PropTypes.Requireable<string>;
    mipFilter: PropTypes.Requireable<string>;
    bloomThreshold: PropTypes.Requireable<number>;
    roughness: PropTypes.Requireable<number>;
    roughnessTexture: PropTypes.Requireable<any>;
    metalness: PropTypes.Requireable<number>;
    metalnessTexture: PropTypes.Requireable<any>;
    ambientOcclusionTexture: PropTypes.Requireable<any>;
};
