const { Op } = require('sequelize')

const express = require('express')
const router = express.Router();

router.get('/:id', async (req, res) => {
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

router.get('/', async (req, res) => {
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

module.exports = router