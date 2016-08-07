/*
 * Module code goes here. Use 'module.exports' to export things:
 * module.exports.thing = 'a thing';
 *
 * You can import it from another modules like this:
 * var mod = require('stats');
 * mod.thing == 'a thing'; // true
 */
function totalEnergy(room){
    var storedEnergy = 0, storedEnergyCapacity = 0
    let containers = room.find(FIND_STRUCTURES, {filter: s => s.structureType === STRUCTURE_CONTAINER || s.structureType === STRUCTURE_STORAGE})
    for(let j = 0; j < containers.length; j++){
        storedEnergy += containers[j].store.energy
        storedEnergyCapacity += containers[j].storeCapacity
    }

    return [room.energyAvailable, room.energyCapacityAvailable, storedEnergy, storedEnergyCapacity]
}

module.exports = {

    totalEnergy: totalEnergy,

    stats: function(){
        for(var i in Game.rooms){
            var closestToExpire = 1500
            var room = Game.rooms[i]
            var totalCreeps = [0,0,0,0,0,0]
            var dyingCreeps = [0,0,0,0,0,0]
            var restingCreeps = 0
            var creeps = room.find(FIND_MY_CREEPS)
            for(var j = 0; j < creeps.length; j++){
                var creep = creeps[j]
                var role = ['harvester', 'builder', 'ranger', 'attacker', 'claimer', 'upgrader'].indexOf(creep.memory.role)
                if(role < 0)
                    continue
                totalCreeps[role]++
                if(creeps[j].ticksToLive < 200)
                    dyingCreeps[role]++
                if(creep.memory.resting)
                    restingCreeps++
                if(creep.ticksToLive < closestToExpire)
                    closestToExpire = creep.ticksToLive
            }
            var creepStats = ''
            for(var j = 0; j < totalCreeps.length; j++){
                creepStats += dyingCreeps[j] + '/' + totalCreeps[j] + (j !== totalCreeps.length-1 ? ',' : '')
            }

            var targets = Game.rooms[i].find(FIND_STRUCTURES, {filter: (x) => x.hits < x.hitsMax && x.hits < 3000});
            var en = totalEnergy(room)
            console.log(Game.time + ' [' + i + '] s:' + targets.length + ', creeps: '
                + creepStats + ',' + restingCreeps + ',' + closestToExpire + ', en: ' + en[0] + '/' + en[1] + ' ' + en[2] + '/' + en[3])
        }
    }
};
