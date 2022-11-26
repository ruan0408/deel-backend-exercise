const express = require('express')
const bodyParser = require('body-parser')
const { sequelize } = require('./model')
const { getProfile } = require('./middleware/getProfile')
const { Op } = require('sequelize')
const app = express()

app.use(bodyParser.json())
app.set('sequelize', sequelize)
app.set('models', sequelize.models)

app.get('/contracts/:id', getProfile, async (req, res) => {
  const { Contract } = req.app.get('models')
  const { id } = req.params
  const profileId = req.profile.id

  const contract = await Contract.findOne({ where: { id } })

  if (!contract) {
    return res.status(404).send('Contract not found')
  }

  if (![contract.ClientId, contract.ContractorId].includes(profileId)) {
    return res.status(403).send('Contract does not belong to user')
  }

  res.json(contract)
})

app.get('/contracts', getProfile, async (req, res) => {
  const { Contract } = req.app.get('models')
  const profileId = req.profile.id

  const contracts = await Contract.findAll({
    where: {
      status: {
        [Op.ne]: 'terminated'
      },
      [Op.or]: [
        {
          ClientId: profileId
        },
        {
          ContractorId: profileId
        }
      ]
    }
  })

  res.json(contracts)
})

app.get('/jobs/unpaid', getProfile, async (req, res) => {
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

app.post('/jobs/:id/pay', getProfile, async (req, res) => {
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

app.post('/balances/deposit/:userId', getProfile, async (req, res) => {
  const { Job, Contract, Profile } = req.app.get('models')
  const { userId } = req.params
  const depositAmount = req.body.amount

  if (!depositAmount) {
    return res.status(400).send('Field amount needs to be sent')
  }

  const user = await Profile.findOne({ where: { id: userId } })

  if (user.type !== 'client') {
    return res.status(403).send('Cant deposit money for a non client user')
  }

  const clientJobs = await Job.findAll({
    where: {
      paid: {
        [Op.or]: [null, false]
      }
    },
    include: [
      {
        model: Contract,
        attributes: [],
        include: [
          {
            model: Profile,
            as: 'Client',
            where: {
              id: userId
            }
          }
        ]
      }
    ]
  })

  const totalJobSum = clientJobs.reduce((acc, job) => acc + job.price, 0)
  const maxDepositAllowed = 0.25 * totalJobSum

  if (depositAmount > maxDepositAllowed) {
    return res.status(400).send(`Deposit amounts exceeds maximum allowed: ${maxDepositAllowed}`)
  }

  user.balance = user.balance + depositAmount
  user.save()

  return res.sendStatus(200)
})

/*
  I used sequelize is the next two routes just because you guys mentioned to always use it, but
  for this kind of analytical query, I would usualy use raw queries.
*/

app.get('/admin/best-profession', getProfile, async (req, res) => {
  const { Job, Contract, Profile } = req.app.get('models')

  const { start, end } = req.query

  const dateRangeFilter = {
    createdAt: {
      ...(start ? { [Op.gte]: new Date(start) } : {}),
      ...(end ? { [Op.lte]: new Date(end) } : {})
    }
  }

  const shouldApplyFilter = start || end

  const bestProfession = await Job.findOne({
    attributes: [
      [sequelize.col('Contract.Contractor.profession'), 'profession'],
      [sequelize.fn('sum', sequelize.col('price')), 'total_amount']
    ],
    where: { paid: true },
    include: [
      {
        model: Contract,
        attributes: [],
        required: true,
        include: [
          {
            model: Profile,
            as: 'Contractor',
            where: shouldApplyFilter ? dateRangeFilter : {}
          }
        ]
      }
    ],
    group: ['Contract.Contractor.profession'],
    order: [
      [sequelize.fn('sum', sequelize.col('price')), 'desc']
    ],
    limit: 1
  })

  return res.status(200).send(bestProfession)
})

app.get('/admin/best-clients', getProfile, async (req, res) => {
  const { Job, Contract, Profile } = req.app.get('models')

  const { start, end, limit } = req.query

  const dateRangeFilter = {
    createdAt: {
      ...(start ? { [Op.gte]: new Date(start) } : {}),
      ...(end ? { [Op.lte]: new Date(end) } : {})
    }
  }

  const shouldApplyFilter = start || end

  const bestClients = await Job.findAll({
    attributes: [
      [sequelize.col('Contract.Client.id'), 'id'],
      [sequelize.literal("`Contract->Client`.`firstName` || ' ' || `Contract->Client`.`lastName`"), 'fullName'],
      [sequelize.fn('sum', sequelize.col('price')), 'paid']
    ],
    where: { paid: true },
    include: [
      {
        model: Contract,
        attributes: [],
        required: true,
        include: [
          {
            model: Profile,
            as: 'Client',
            where: shouldApplyFilter ? dateRangeFilter : {}
          }
        ]
      }
    ],
    group: ['Contract.Client.id'],
    order: [
      [sequelize.fn('sum', sequelize.col('price')), 'desc']
    ],
    limit
  })

  return res.status(200).send(bestClients)
})

module.exports = app
