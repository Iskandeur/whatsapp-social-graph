const axios = require('axios');

class WahaClient {
    constructor(endpoint = 'http://localhost:3000', apiKey = null) {
        this.endpoint = endpoint;
        this.apiKey = apiKey;
        this.session = 'default';
        this.axios = axios.create({
            baseURL: this.endpoint,
            timeout: 300000, // Increased to 5 minutes for massive accounts
            headers: this.apiKey ? { 'X-Api-Key': this.apiKey } : {}
        });
    }

    async getStatus() {
        try {
            // Check session status
            const response = await this.axios.get(`/api/sessions/${this.session}`);
            return response.data;
        } catch (error) {
            console.error('Error fetching status:', error.message);
            return null;
        }
    }

    async getQR() {
        try {
            return await this.retry(async () => {
                const response = await this.axios.get(`/api/${this.session}/auth/qr?format=image`, {
                    responseType: 'arraybuffer'
                });
                // Convert binary to base64 data URL
                const base64 = Buffer.from(response.data, 'binary').toString('base64');
                return `data:image/png;base64,${base64}`;
            }, 'getQR', 3, 1000);
        } catch (error) {
            // If session is already scanned, this might 400 or 404, or return nothing
            return null;
        }
    }

    async getContacts() {
        return this.retry(async () => {
            // Revert to query param style as WEBJS engine returns 404 for session-scoped contacts
            const response = await this.axios.get(`/api/contacts?session=${this.session}`);
            return response.data;
        }, 'getContacts');
    }

    async getChats() {
        let allChats = [];
        let offset = 0;
        const limit = 50;

        while (true) {
            try {
                // Use session-scoped endpoint with pagination to avoid 500 timeouts
                const response = await this.retry(async () => {
                    return this.axios.get(`/api/${this.session}/chats?limit=${limit}&offset=${offset}`);
                }, `getChats-offset-${offset}`);

                const chats = response.data;

                if (!Array.isArray(chats) || chats.length === 0) {
                    break;
                }

                allChats = allChats.concat(chats);

                if (chats.length < limit) {
                    break;
                }

                offset += limit;
                // Small delay to be nice to the engine
                await new Promise(resolve => setTimeout(resolve, 500));
                if (chats.length < limit) {
                    break;
                }

                offset += limit;
                // Small delay to be nice to the engine
                await new Promise(resolve => setTimeout(resolve, 500));
            } catch (error) {
                console.error(`Error fetching chats (offset ${offset}):`, error.message);

                // If the first page fails, throw the error so we don't return an empty array and fool the app
                if (offset === 0) {
                    throw error;
                }

                // For subsequent pages, return what we have so far
                return allChats;
            }
        }

        return allChats;
    }

    async retry(fn, operationName, retries = 5, delay = 2000) {
        for (let i = 0; i < retries; i++) {
            try {
                return await fn();
            } catch (error) {
                const isLastAttempt = i === retries - 1;
                if (isLastAttempt) throw error;

                // Only retry on 5xx errors or network errors
                if (error.response && error.response.status >= 500 || !error.response) {
                    console.log(`WahaClient: ${operationName} failed (Attempt ${i + 1}/${retries}). Retrying in ${delay}ms... Error: ${error.message}`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    delay *= 1.5; // Exponential backoff
                } else {
                    throw error; // 4xx errors are likely permanent
                }
            }
        }
    }

    async getMessages(chatId, limit = 50) {
        return this.retry(async () => {
            const response = await this.axios.get(`/api/${this.session}/chats/${chatId}/messages?limit=${limit}`);
            return response.data;
        }, `getMessages-${chatId}`, 3, 1000); // Fewer retries for individual message fetches
    }

    async getMe() {
        const response = await this.axios.get(`/api/sessions/${this.session}/me`);
        return response.data;
    }

    async logout() {
        try {
            await this.axios.post(`/api/sessions/${this.session}/logout`);
            return true;
        } catch (error) {
            console.error('Error logging out:', error.message);
            return false;
        }
    }

    async startSession() {
        try {
            await this.axios.post('/api/sessions', {
                name: this.session,
                config: {
                    proxy: null,
                    webhooks: [],
                    noweb: {
                        store: {
                            enabled: true,
                            full_sync: true
                        }
                    }
                }
            });
        } catch (e) {
            if (e.response && e.response.status === 422) {
                console.log('Session already exists, attempting to start it...');
                try {
                    await this.axios.post(`/api/sessions/${this.session}/start`);
                    console.log('Session started successfully.');
                } catch (startErr) {
                    console.error('Error starting existing session:', startErr.message);
                }
            } else {
                console.error('Error starting session:', e.message);
            }
        }
    }
}

module.exports = { WahaClient };
