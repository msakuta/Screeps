/*
 * Module code goes here. Use 'module.exports' to export things:
 * module.exports.thing = 'a thing';
 *
 * You can import it from another modules like this:
 * var mod = require('stats');
 * mod.thing == 'a thing'; // true
 */

var totalEnergyCache = {}

function resetCache(){
    // Make sure previous ticks won't mess up things
    totalEnergyCache = {}
}

function totalEnergy(room){
    if(!totalEnergyCache[room.name]){
        var storedEnergy = 0, storedEnergyCapacity = 0
        let containers = room.find(FIND_STRUCTURES, {filter: s => s.structureType === STRUCTURE_CONTAINER || s.structureType === STRUCTURE_STORAGE || s.structureType === STRUCTURE_TERMINAL})
        for(let j = 0; j < containers.length; j++){
            storedEnergy += containers[j].store.energy
            storedEnergyCapacity += containers[j].storeCapacity
        }
        let links = room.find(FIND_STRUCTURES, {filter: s => s.structureType === STRUCTURE_LINK})
        for(let j = 0; j < links.length; j++){
            storedEnergy += links[j].energy
            storedEnergyCapacity += links[j].energyCapacity
        }

        // Automatically cache return value to private static variable to return
        // for the second or later invocation of the function.
        // I thought it works because the value does not change throughout the tick and
        // all global variables except Memory are cleared at the end of each tick, but
        // actually it's stored in a forked VM and somehow propagates among ticks.
        // Apparently this behavior is unstable (probably due to multiple process
        // sharing), so we cannot rely on it.
        totalEnergyCache[room.name] = [room.energyAvailable, room.energyCapacityAvailable, storedEnergy, storedEnergyCapacity]
    }
    return totalEnergyCache[room.name]
}

module.exports = {

    resetCache: resetCache,

    totalEnergy: totalEnergy,

    stats: function(){
        for(var i in Game.rooms){
            // There is no handly equivalent in libraries...
            function repeatArray(n,v){
                var ret = []
                while(ret.length < n)
                    ret.push(v)
                return ret
            }
            var closestToExpire = 1500
            var room = Game.rooms[i]
            var roles = ['harvester', 'builder', 'digger', 'ranger', 'interceptor', 'attacker', 'claimer', 'transporter', 'upgrader']
            var totalCreeps = repeatArray(roles.length, 0)
            var dyingCreeps = repeatArray(roles.length, 0)
            var restingCreeps = 0
            var creeps = room.find(FIND_MY_CREEPS)
            for(var j = 0; j < creeps.length; j++){
                var creep = creeps[j]
                var role = roles.indexOf(creep.memory.role)
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
                if(totalCreeps[j])
                    creepStats += (creepStats !== '' ? ', ' : '') + roles[j] + ': ' + dyingCreeps[j] + '/' + totalCreeps[j]
            }

            var strClosestToExpire = closestToExpire === 1500 ? '' : 'ETA: ' + closestToExpire + ', '

            var targets = Game.rooms[i].find(FIND_STRUCTURES, {filter: (x) => x.hits < x.hitsMax && x.hits < 3000});
            var en = totalEnergy(room)
            console.log(Game.time + ' [' + i + '] s:' + targets.length + ', creeps: '
                + _.sum(dyingCreeps) + '/' + _.sum(totalCreeps) + ' ' + creepStats + ', '
                + strClosestToExpire + 'en: ' + en[0] + '/' + en[1] + ' ' + en[2] + '/' + en[3])
        }
    }
};
