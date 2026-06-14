import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import { supabase } from './supabase';
import * as Crypto from 'expo-crypto';

export const configureGoogleSignIn = () => {
  GoogleSignin.configure({
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  });
};

export const signInWithGoogle = async () => {
  try {
    await GoogleSignin.hasPlayServices();

    // Step 1: Generate raw nonce
    const rawNonce = Math.random().toString(36).substring(2, 18) +
                     Math.random().toString(36).substring(2, 18);

    // Step 2: Hash it for Google
    const hashedNonce = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      rawNonce,
    );

    // Step 3: Sign in with Google using the HASHED nonce
    const userInfo = await GoogleSignin.signIn({ nonce: hashedNonce });

    if (!userInfo.data?.idToken) {
      throw new Error('No ID token returned from Google');
    }

    // Step 4: Pass the RAW nonce to Supabase (it will hash it internally to verify)
    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'google',
      token: userInfo.data.idToken,
      nonce: rawNonce,
    });

    if (error) throw error;
    return { data, error: null };

  } catch (error: any) {
    if (error.code === statusCodes.SIGN_IN_CANCELLED) {
      return { data: null, error: null };
    }
    return { data: null, error };
  }
};

export const signOutFromGoogle = async () => {
  try {
    await GoogleSignin.signOut();
  } catch (error) {
    console.log('Google sign out error:', error);
  }
};
