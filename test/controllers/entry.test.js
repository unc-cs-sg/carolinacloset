const supertest = require('supertest');
const should = require('should');
const app = require('../../app');
const dbUtil = require('../../db/db-util.js')
require('dotenv').config()

const adminAuthHeaders = {
    uid: process.env.DEFAULT_ADMIN
};
const volunteerAuthHeaders = {
    uid: 'volunteerOnyen'
};
const userAuthHeaders = {
    uid: "userOnyen"
};

const MANUAL_CREATE_SUCCESS = /New item successfully created, id:/;
const ITEM_FOUND_MESSAGE = /Item already found in database, do you want to update this entry/;
const MANUAL_UPDATE_SUCCESS = /Item successfully updated/;
const MANUAL_UPDATE_ERROR = /Error updating item/;
const SUCCESS_QUERY_PARAM = /success=1/;
const ERROR_QUERY_PARAM = /success=0/;
// Checks response body for a match to the fail message on invalid CSV import
let matchResponseText = (res, pattern) => {
    res.text.should.match(pattern);
}

describe('Entry Routes - GET pages', () => {
    describe('GET /entry - entry main page', () => {
        it('expect success HTTP 200 status', (done) => {
            supertest(app).get('/entry')
                .set(adminAuthHeaders)
                .expect(200, done);
        });
    });

    describe('GET /entry/search - search entry page', () => {
        it('expect success HTTP 200 status', (done) => {
            supertest(app).get('/entry/search')
                .set(adminAuthHeaders)
                .expect(200, done);
        });
    });

    describe('GET /entry/manual - manual entry page', () => {
        it('expect success HTTP 200 status', (done) => {
            supertest(app).get('/entry/manual')
                .set(adminAuthHeaders)
                .expect(200, done);
        });
    });

    describe('GET /entry/manual - manual entry page, update success', () => {
        it('expect success HTTP 200 status', (done) => {
            supertest(app).get('/entry/manual')
                .set(adminAuthHeaders)
                .query({ success: '1' })
                .expect((res) => matchResponseText(res, MANUAL_UPDATE_SUCCESS))
                .expect(200, done);
        });
    });

    describe('GET /entry/manual - manual entry page, update error', () => {
        it('expect success HTTP 200 status', (done) => {
            supertest(app).get('/entry/manual')
                .set(adminAuthHeaders)
                .query({ success: '0' })
                .expect((res) => matchResponseText(res, MANUAL_UPDATE_ERROR))
                .expect(200, done);
        });
    });

    describe('GET /entry/import - items CSV import page', () => {
        it('expect success HTTP 200 status', (done) => {
            supertest(app).get('/entry/import')
                .set(adminAuthHeaders)
                .expect(200, done);
        });
    });
});

describe('Entry Routes - Entry Workflow', () => {
    describe('POST /entry/search - search for item by name', () => {
        it('expect success HTTP 200 status', (done) => {
            let requestBody = {
                searchTerm: 'chicken',
                barcode: ''
            };
            supertest(app).post('/entry/search')
                .set(adminAuthHeaders)
                .send(requestBody)
                .expect(200, done);
        });
    });

    describe('POST /entry/search - search for item by barcode', () => {
        it('expect success HTTP 200 status', (done) => {
            let requestBody = {
                searchTerm: '',
                barcode: '123456789012'
            };
            supertest(app).post('/entry/search')
                .set(adminAuthHeaders)
                .send(requestBody)
                .expect(200, done);
        });
    });

    describe('POST /entry/manual - create a new item', () => {
        it('expect success HTTP 200 status', (done) => {
            let requestBody = {
                name: 'chicken',
                barcode: '123456789012',
                description: 'meaty',
                count: 1
            };
            supertest(app).post('/entry/manual')
                .set(adminAuthHeaders)
                .send(requestBody)
                .expect((res) => matchResponseText(res, MANUAL_CREATE_SUCCESS))
                .expect(200, done);
        });
    });

    describe('POST /entry/manual - attempt to create existing item', () => {
        it('expect success HTTP 200 status', (done) => {
            let requestBody = {
                name: 'chicken',
                barcode: '123456789012',
                description: 'meaty',
                count: 1
            };
            supertest(app).post('/entry/manual')
                .set(adminAuthHeaders)
                .send(requestBody)
                .expect((res) => matchResponseText(res, ITEM_FOUND_MESSAGE))
                .expect(200, done);
        });
    });

    describe('POST /entry/manual - attempt to create existing item, no barcode', () => {
        it('expect success HTTP 200 status', (done) => {
            let requestBody = {
                name: 'chicken',
                description: 'meaty',
                count: 1
            };
            supertest(app).post('/entry/manual')
                .set(adminAuthHeaders)
                .send(requestBody)
                .expect((res) => matchResponseText(res, ITEM_FOUND_MESSAGE))
                .expect(200, done);
        });
    });

    describe('POST /entry/manual/update - manually add count to existing item', () => {
        it('expect success HTTP 302 status', (done) => {
            let requestBody = {
                id: 1,
                quantity: 5
            };
            supertest(app).post('/entry/manual/update')
                .set(adminAuthHeaders)
                .send(requestBody)
                .expect((res) => matchResponseText(res, SUCCESS_QUERY_PARAM))
                .expect(302, done);
        });
    });

    describe('POST /entry/manual/update - manually remove count from existing item', () => {
        it('expect success HTTP 302 status', (done) => {
            let requestBody = {
                id: 1,
                quantity: -1
            };
            supertest(app).post('/entry/manual/update')
                .set(adminAuthHeaders)
                .send(requestBody)
                .expect((res) => matchResponseText(res, SUCCESS_QUERY_PARAM))
                .expect(302, done);
        });
    });

    describe('POST /entry/manual/update - manually add count to existing item, invalid quantity', () => {
        it('expect success HTTP 302 status', (done) => {
            let requestBody = {
                id: 1,
                quantity: -100
            };
            supertest(app).post('/entry/manual/update')
                .set(adminAuthHeaders)
                .send(requestBody)
                .expect((res) => matchResponseText(res, ERROR_QUERY_PARAM))
                .expect(302, done);
        });
    });

    describe('POST /entry/manual/update - manually add count to existing item, non-number quantity', () => {
        it('expect success HTTP 302 status', (done) => {
            let requestBody = {
                id: 1,
                quantity: "test"
            };
            supertest(app).post('/entry/manual/update')
                .set(adminAuthHeaders)
                .send(requestBody)
                .expect((res) => matchResponseText(res, ERROR_QUERY_PARAM))
                .expect(302, done);
        });
    });

    describe('POST /entry/add - add from search entry page', () => {
        it('expect success HTTP 302 status', (done) => {
            let requestBody = {
                id: 1,
                count: 1,
            };
            supertest(app).post('/entry/add')
                .set(adminAuthHeaders)
                .send(requestBody)
                .expect(302, done);
        });
    });

    describe('POST /entry/remove - remove from search entry page', () => {
        it('expect success HTTP 302 status', (done) => {
            let requestBody = {
                id: 1,
                count: 1,
                onyen: 'onyen'
            };
            supertest(app).post('/entry/remove')
                .set(adminAuthHeaders)
                .send(requestBody)
                .expect(302, done);
        });
    });
});

describe('Entry Routes - Not Authorized', () => {
    describe('GET /entry - entry main page', () => {
        it('expect HTTP 403 status', (done) => {
            supertest(app).get('/entry')
                .set(userAuthHeaders)
                .expect(403, done);
        });
    });

    describe('GET /entry/search - search entry page', () => {
        it('expect HTTP 403 status', (done) => {
            supertest(app).get('/entry/search')
                .set(userAuthHeaders)
                .expect(403, done);
        });
    });

    describe('POST /entry/search - search for item', () => {
        it('expect HTTP 403 status', (done) => {
            supertest(app).post('/entry/search')
                .set(userAuthHeaders)
                .expect(403, done);
        });
    });

    describe('GET /entry/manual - manual entry page', () => {
        it('expect HTTP 403 status', (done) => {
            supertest(app).get('/entry/manual')
                .set(userAuthHeaders)
                .expect(403, done);
        });
    });

    describe('POST /entry/manual - manually create new item', () => {
        it('expect HTTP 403 status', (done) => {
            supertest(app).post('/entry/manual')
                .set(userAuthHeaders)
                .expect(403, done);
        });
    });

    describe('POST /entry/manual/update - manually update existing item', () => {
        it('expect HTTP 403 status', (done) => {
            supertest(app).post('/entry/manual/update')
                .set(userAuthHeaders)
                .expect(403, done);
        });
    });

    describe('POST /entry/add - create an add transaction', () => {
        it('expect HTTP 403 status', (done) => {
            supertest(app).post('/entry/add')
                .set(userAuthHeaders)
                .expect(403, done);
        });
    });

    describe('POST /entry/remove - create a remove transaction', () => {
        it('expect HTTP 403 status', (done) => {
            supertest(app).post('/entry/remove')
                .set(userAuthHeaders)
                .expect(403, done);
        });
    });

    describe('POST /entry/found - scanned item found in Datakick', () => {
        it('expect HTTP 403 status', (done) => {
            supertest(app).post('/entry/found')
                .set(userAuthHeaders)
                .expect(403, done);
        });
    });

    describe('GET /entry/import - items CSV import page', () => {
        it('expect HTTP 403 status', (done) => {
            supertest(app).get('/entry/import')
                .set(userAuthHeaders)
                .expect(403, done);
        });
    });

    describe('POST /entry/import - upload items CSV', () => {
        it('expect HTTP 403 status', (done) => {
            supertest(app).post('/entry/import')
                .set(userAuthHeaders)
                .expect(403, done);
        });
    });
});