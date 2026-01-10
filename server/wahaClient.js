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
            const response = await this.axios.get(`/api/${this.session}/auth/qr?format=image`, {
                responseType: 'arraybuffer'
            });
            // Convert binary to base64 data URL
            const base64 = Buffer.from(response.data, 'binary').toString('base64');
            return `data:image/png;base64,${base64}`;
        } catch (error) {
            // If session is already scanned, this might 400 or 404, or return nothing
            return null;
        }
    }

    async getContacts() {
        // Revert to query param style as WEBJS engine returns 404 for session-scoped contacts
        try {
            const response = await this.axios.get(`/api/contacts?session=${this.session}`);
            return response.data;
        } catch (error) {
            // If contacts fail (e.g. 500 error from Waha bug), return empty array so we can proceed with chats
            console.error('Error fetching contacts (suppressed):', error.message);
            return [];
        }
    }

    async getChats() {
        const response = await this.axios.get(`/api/${this.session}/chats`);
        return response.data;
    }

    async getMessages(chatId, limit = 50) {
        const response = await this.axios.get(`/api/${this.session}/chats/${chatId}/messages?limit=${limit}`);
        return response.data;
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
                    webhooks: []
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
