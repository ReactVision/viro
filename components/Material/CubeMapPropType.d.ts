import { ViroSource } from "@components/Types/ViroUtils";
import PropTypes from "prop-types";
import { ImageResolvedAssetSource } from "react-native";
export declare type ViroCubeMap = {
    nx: ViroSource;
    px: ViroSource;
    ny: ViroSource;
    py: ViroSource;
    nz: ViroSource;
    pz: ViroSource;
};
export declare type ViroResolvedCubeMap = {
    nx: ImageResolvedAssetSource;
    px: ImageResolvedAssetSource;
    ny: ImageResolvedAssetSource;
    py: ImageResolvedAssetSource;
    nz: ImageResolvedAssetSource;
    pz: ImageResolvedAssetSource;
};
export declare const CubeMapPropType: PropTypes.Requireable<PropTypes.InferProps<{
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
