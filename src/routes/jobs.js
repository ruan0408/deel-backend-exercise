
const { Op } = require('sequelize')
const { sequelize } = require('../model')

const express = require('express')
const router = express.Router();

router.get('/unpaid', async (req, res) => {
  const { Job, Contract } = req.app.get('models')
  const profileId = req.profile.id

  const jobs = await Job.findAll({
    where: {
      paid: {
        [Op.or]: [null, false]
      }
    },
    include: [
      {
        model: Contract,
        attributes: [],
        where: {
          status: {
            [Op.ne]: 'terminated'
          },
          [Op.or]: [
            { ClientId: profileId },
            { ContractorId: profileId }
          ]
        }
      }
    ]
  })

  res.json(jobs)
})

router.post('/:id/pay', async (req, res) => {
  const { Job, Contract, Profile } = req.app.get('models')
  const profile = req.profile
  const { id } = req.params

  const job = await Job.findOne({
    where: { id },
    include: [
      {
        model: Contract,
        include: [
          {
            model: Profile,
            as: 'Contractor'
          }
        ]
      }
    ]
  })

  if (profile.type !== 'client') {
    return res.status(403).send('User is not a client. Only clients can pay jobs')
  }

  if (job.paid) {
    return res.status(403).send('Job is already paid')
  }

  if (job.price > profile.balance) {
    return res.status(403).send('Insuficient funds to pay job')
  }

  const client = profile
  const contractor = job.Contract.Contractor

  await sequelize.transaction(async () => {
    job.paid = true
    job.paymentDate = new Date()

    client.balance = client.balance - job.price
    contractor.balance = contractor.balance + job.price

    await Promise.all([
      client.save(),
      job.save(),
      contractor.save()
    ])
  })

  return res.sendStatus(200)
})

module.exports = router