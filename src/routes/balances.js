const { Op } = require('sequelize')

const express = require('express')
const router = express.Router();

router.post('/deposit/:userId', async (req, res) => {
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

module.exports = router