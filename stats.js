/*
 * Module code goes here. Use 'module.exports' to export things:
 * module.exports.thing = 'a thing';
 *
 * You can import it from another modules like this:
 * var mod = require('stats');
 * mod.thing == 'a thing'; // true
 */
function totalEnergy(room){
    var energy = 0, energyCapacity = 0
    energy += Game.spawns.Spawn1.energy
    energyCapacity += Game.spawns.Spawn1.energyCapacity
    var exts = room.find(FIND_MY_STRUCTURES, {filter: (s) => s.structureType === STRUCTURE_EXTENSION})
    for(var i = 0; i < exts.length; i++){
        energy += exts[i].energy;
        energyCapacity += exts[i].energyCapacity
    }
    return [energy, energyCapacity]
}

module.exports = {
    stats: function(){
        for(var i in Game.rooms){
            var closestToExpire = 1500
            var room = Game.rooms[i]
            var totalCreeps = [0,0,0,0]
            var dyingCreeps = [0,0,0,0]
            var restingCreeps = 0
            var creeps = room.find(FIND_MY_CREEPS)
            for(var j = 0; j < creeps.length; j++){
                var creep = creeps[j]
                var role = creep.memory.role === 'harvester' ? 0 : creep.memory.role === 'builder' ? 1 : creep.memory.role === 'ranger' ? 2 : 3
                totalCreeps[role]++
                if(creeps[j].ticksToLive < 200)
                    dyingCreeps[role]++
                if(creep.memory.resting)
                    restingCreeps++
                if(creep.ticksToLive < closestToExpire)
                    closestToExpire = creep.ticksToLive
            }
            var creepStats = ''
            for(var j = 0; j < 4; j++){
                creepStats += dyingCreeps[j] + '/' + totalCreeps[j] + (j !== 3 ? ',' : '')
            }

            var targets = Game.rooms[i].find(FIND_STRUCTURES, {filter: (x) => x.hits < x.hitsMax && x.hits < 3000});
            var en = totalEnergy(room)
            console.log(Game.time + ' [' + i + '] s:' + targets.length + ', creeps: '
                + creepStats + ',' + restingCreeps + ',' + closestToExpire + ', en: ' + en[0] + '/' + en[1])
        }
    }
};
