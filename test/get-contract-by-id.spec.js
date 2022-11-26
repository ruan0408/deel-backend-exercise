/* eslint-disable mocha/no-mocha-arrows */
const { expect } = require('chai');
const request = require('supertest');

const app = require('../src/app')

/*
  I would usually setup transactional tests. Every operation would occur in a database transaction and would be rolled back
  after the test. So I wouldnt need to keep deleting data before each test.
  Since I'm short on time, I will just use the seed data here.
*/

describe('GET /contracts/:id', () => {
  const userId = 1

  function makeRequest(id, profileId = userId) {
    return request(app).get(`/contracts/${id}`).send().set('profile_id', profileId);
  }

  describe('when user is not authenticated', () => {
    it('returns 401', async () => {
      const { status } = await makeRequest(3, 100)

      expect(status).to.equal(401)
    })
  })

  describe('when contract belongs to a different user', () => {
    it('returns 403', async () => {
      const { status } = await makeRequest(3)

      expect(status).to.equal(403)
    })
  })

  describe('when contract is not found', () => {
    it('returns 404', async () => {
      const { status } = await makeRequest(100)

      expect(status).to.equal(404)
    })
  })

  describe('when everything goes right', () => {
    it('returns 200 and contract data', async () => {
      const { status, body } = await makeRequest(2)

      expect(status).to.equal(200)
      expect(body).to.deep.equal({
        ClientId: 1,
        ContractorId: 6,
        createdAt: "2022-11-26T01:07:29.914Z",
        id: 2,
        status: "in_progress",
        terms: "bla bla bla",
        updatedAt: "2022-11-26T01:07:29.914Z",
      })
    })
  })
})