import pincodeLib from 'indian-pincodes';

export function pincodeToCity(pincode: string | null | undefined): string | null {
  if (!pincode || !/^\d{6}$/.test(pincode)) {
    return null;
  }
  try {
    const details = pincodeLib.getPincodeDetails(Number(pincode));
    if (details) {
      if (details.state === 'Delhi' || details.circle === 'Delhi') {
        return 'Delhi';
      }
      return details.district || details.region || details.state || null;
    }
  } catch (err) {
    console.error(`Error looking up pincode ${pincode}:`, err);
  }
  return null;
}
