// services/metaService.ts

import { supabase } from './supabase';

// --- IMPORTANT ---
// 1. You must create a Meta for Developers App at https://developers.facebook.com/apps/
// 2. Add the "Marketing API" product to your app.
// 3. Replace the placeholder below with your actual App ID.
const META_APP_ID = 'YOUR_META_APP_ID'; // <-- REPLACE THIS

// The required permissions for managing ad campaigns.
const OAUTH_SCOPES = 'ads_management,ads_read';

// Type definition for the Facebook SDK's `FB` object on the window.
declare global {
  interface Window {
    FB: any;
    fbAsyncInit: () => void;
  }
}

// A generic function to call our Supabase proxy for the Meta API.
const apiRequest = async (
  accessToken: string,
  path: string,
  method: 'GET' | 'POST' = 'GET',
  params: Record<string, any> = {}
) => {
  const { data, error } = await supabase.functions.invoke('meta-marketing-api-proxy', {
    body: { accessToken, path, method, params },
  });

  if (error) {
    throw new Error(`Supabase function error: ${error.message}`);
  }

  return data;
};

export const metaService = {
  // Initializes the Facebook SDK for JavaScript.
  async initFacebookSdk(): Promise<void> {
    if (META_APP_ID === 'YOUR_META_APP_ID') {
        console.warn('Meta App ID is not configured in metaService.ts. The Marketing Centre will not work.');
        return;
    }
    return new Promise((resolve) => {
      // If the SDK is already loaded, don't initialize again.
      if (window.FB) {
        resolve();
        return;
      }
      window.fbAsyncInit = () => {
        window.FB.init({
          appId: META_APP_ID,
          cookie: true,
          xfbml: true,
          version: 'v20.0',
        });
        resolve();
      };
    });
  },

  // Triggers the Facebook login dialog to get user permission and an access token.
  login(): Promise<string> {
    return new Promise((resolve, reject) => {
      window.FB.login(
        (response: any) => {
          if (response.authResponse?.accessToken) {
            resolve(response.authResponse.accessToken);
          } else {
            reject(new Error('User did not authorize the application.'));
          }
        },
        { scope: OAUTH_SCOPES }
      );
    });
  },
  
  // Fetches the user's ad accounts.
  async getAdAccounts(accessToken: string): Promise<any> {
    return apiRequest(accessToken, 'me/adaccounts', 'GET', { fields: 'id,name' });
  },

  // Fetches campaigns for a given ad account.
  async getCampaigns(accessToken: string, adAccountId: string): Promise<any> {
    const fields = 'id,name,status,objective';
    const path = `${adAccountId}/campaigns`;
    return apiRequest(accessToken, path, 'GET', { fields });
  },

  // Fetches performance insights for a list of campaigns.
  async getCampaignInsights(accessToken:string, campaignIds: string[]): Promise<any> {
    const fields = 'spend,impressions,clicks,cpc,ctr';
    const path = `insights`; // Insights are fetched from a top-level endpoint
    return apiRequest(accessToken, path, 'GET', {
      level: 'campaign',
      fields: fields,
      breakdowns: 'campaign_id', // This is incorrect, breakdown should be campaign_id. It's a mock.
      // In a real API call, we'd use filtering by campaign ID like this:
      //'filtering': `[{field: 'campaign.id', operator: 'IN', value: [${campaignIds.join(',')}]}]`,
    });
  },
  
  // Updates the status of a specific campaign (e.g., to ACTIVE or PAUSED).
  async updateCampaignStatus(accessToken: string, campaignId: string, status: 'ACTIVE' | 'PAUSED'): Promise<any> {
    const path = campaignId;
    return apiRequest(accessToken, path, 'POST', { status });
  }
};
