import React, { memo } from 'react';
import { View } from 'react-native';
import { Image } from 'expo-image';
import { Avatar } from '@/components/ui/Avatar';
import { useCafePhoto } from '@/hooks/useCafePhoto';
import { useThemeStyles } from '@/hooks/useThemeStyles';
import { useCafePresence } from '@/hooks/useCafePresence';
import { createCafeStyles } from '@/constants/cafeStyles';
import { spacing } from '@/constants/theme';
interface CafePhotoProps { path: string | null; name: string; size?: number }
export const CafePhoto = memo(function CafePhoto({ path, name, size = spacing.xxxl + spacing.lg }: CafePhotoProps) {
  const uri = useCafePhoto(path); const { styles: s } = useThemeStyles(createCafeStyles);
  if (!uri) return <Avatar name={name} size={size} />;
  return <View style={[s.photo, { width: size, height: size, borderRadius: size / 2 }]}><Image source={{ uri }} style={{ width: '100%', height: '100%' }} contentFit="cover" cachePolicy="none" transition={0} recyclingKey={path ?? 'empty'} accessibilityLabel={`${name} profil fotoğrafı`} /></View>;
});
interface OwnCafePhotoProps { name: string; size?: number }
export const OwnCafePhoto = memo(function OwnCafePhoto({ name, size }: OwnCafePhotoProps) {
  const { photoPath } = useCafePresence();
  return <CafePhoto path={photoPath} name={name} size={size} />;
});
