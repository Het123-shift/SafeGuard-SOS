// Web stub — no react-native-maps import (native-only module)
import React from 'react';
import { View } from 'react-native';

export const PROVIDER_GOOGLE = 'google';

const MapView = React.forwardRef(function MapView({ style, children }: any, _ref: any) {
  return <View style={style}>{children}</View>;
});

export function Marker(_props: any) { return null; }
export function Circle(_props: any) { return null; }
export default MapView;
