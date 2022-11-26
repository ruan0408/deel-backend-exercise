const { Op } = require('sequelize')
const { sequelize } = require('../model')

const express = require('express')
const router = express.Router();

/*
  I used sequelize is the next two routes just because you guys mentioned to always use it, but
  for this kind of analytical query, I would usualy use raw queries.
*/

router.get('/best-profession', async (req, res) => {
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

router.get('/best-clients', async (req, res) => {
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

module.exports = router
