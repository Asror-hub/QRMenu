import Constants from "expo-constants";

const cloudName =
  Constants.expoConfig?.extra?.cloudinaryCloudName ??
  (process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME as string) ??
  "";
const uploadPreset =
  Constants.expoConfig?.extra?.cloudinaryUploadPreset ??
  (process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET as string) ??
  "";

export const uploadImage = async (uri: string, filename?: string): Promise<{ secureUrl: string; publicId: string }> => {
  if (!cloudName || !uploadPreset) {
    throw new Error("Cloudinary env vars are missing.");
  }

  const formData = new FormData();
  formData.append("file", {
    uri,
    name: filename ?? "image.jpg",
    type: "image/jpeg",
  } as unknown as Blob);
  formData.append("upload_preset", uploadPreset);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    {
      method: "POST",
      body: formData,
      headers: {
        "Content-Type": "multipart/form-data",
      },
    }
  );

  if (!response.ok) {
    throw new Error("Image upload failed.");
  }

  const data = await response.json();
  return {
    secureUrl: data.secure_url,
    publicId: data.public_id,
  };
};
